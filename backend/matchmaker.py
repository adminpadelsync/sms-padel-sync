from database import supabase
from twilio_client import send_sms
from datetime import datetime, timedelta, timezone
import pytz
from logic_utils import is_quiet_hours, parse_iso_datetime, get_now_utc, format_sms_datetime, get_club_timezone
from redis_client import clear_user_state, set_user_state
import sms_constants as msg


# Configuration
BATCH_SIZE = 6  # Number of invites to send at a time
INVITE_TIMEOUT_MINUTES = 15  # Time before invite expires


def find_and_invite_players(match_id: str, batch_number: int = 1, max_invites: int = None, skip_filters: bool = False, target_player_ids: list[str] = None):
    """
    Finds compatible players for a match and sends SMS invites in batches.
    
    Args:
        match_id: The match to find players for
        batch_number: Which batch this is (for tracking)
        max_invites: Override for number of invites (used for replacements)
        skip_filters: If True, skip level/gender filtering (used for group invites)
        target_player_ids: If provided, only invite these specific players (Admin UI path)
    
    Returns:
        Number of invites sent
    """
    import sys
    print(f"Finding players for match {match_id} (batch {batch_number}, skip_filters={skip_filters})...")
    sys.stdout.flush()
    
    # 1. Get Match Details
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_res.data:
        print("Match not found.")
        return 0
    match = match_res.data[0]
    club_id = match.get("club_id")
    
    # Check for quiet hours cancellation
    is_quiet = is_quiet_hours(club_id)
    if is_quiet:
        print(f"[QUIET HOURS] Deferring invites for club {club_id} (pending_sms mode)")
        # We continue to create the records, but they will have status 'pending_sms'
    
    # Check if match is still pending/active
    if match["status"] not in ["pending", "voting"]:
        print(f"Match status is {match['status']}, not inviting.")
        return 0
        
    # Phase 4 Update: Use match_participations for requester (originator/team_1 lead)
    from logic_utils import get_match_participants
    participants = get_match_participants(match_id)
    requester_id = participants["team_1"][0] if participants["team_1"] else match.get("originator_id")

    requester = None
    if requester_id:
        player_res = supabase.table("players").select("*").eq("player_id", requester_id).execute()
        if player_res.data:
            requester = player_res.data[0]
            
    if not requester and not skip_filters:
        # If no requester and we need filtering, we might have issues determining target level
        pass  
    
    # Fetch club name and settings for SMS messages and timeout
    club_name = "the club"
    invite_timeout_minutes = INVITE_TIMEOUT_MINUTES
    if club_id:
        club_res = supabase.table("clubs").select("name, settings").eq("club_id", club_id).execute()
        if club_res.data:
            club_data = club_res.data[0]
            club_name = club_data["name"]
            settings = club_data.get("settings") or {}
            invite_timeout_minutes = settings.get("invite_timeout_minutes", INVITE_TIMEOUT_MINUTES)
    
    # Get match preferences (or use defaults) - only used if not skipping filters
    level_min = match.get("level_range_min")
    level_max = match.get("level_range_max")
    gender_preference = match.get("gender_preference", "mixed")
    
    # If no level range set and not skipping filters, use requester's level ± 0.25
    if not skip_filters and (level_min is None or level_max is None):
        target_level = 3.5
        if requester:
            target_level = requester.get("adjusted_skill_level") or requester.get("declared_skill_level") or 3.5
        level_min = target_level - 0.25
        level_max = target_level + 0.25
    
    # 2. Find active players in the club
    # First get member IDs
    members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
    member_ids = [m["player_id"] for m in (members_res.data or [])]
    
    if target_player_ids and len(target_player_ids) > 0:
        # Use specific players provided by Admin
        candidates_res = supabase.table("players").select("*").in_("player_id", target_player_ids).execute()
    else:
        # Standard filter logic
        candidates_res = supabase.table("players").select("*").in_("player_id", member_ids).eq("active_status", True).execute()
    
    # Filter by Group if applicable
    target_group_id = match.get("target_group_id")
    group_member_ids = None
    
    if target_group_id:
        print(f"Match {match_id} is targeted to group {target_group_id}")
        # New schema: Query group_memberships table
        group_res = supabase.table("group_memberships").select("player_id").eq("group_id", target_group_id).execute()
        if group_res.data:
            group_member_ids = {row["player_id"] for row in group_res.data}
            print(f"Group found with {len(group_member_ids)} members.")
        else:
            print("Target group not found or empty.")
            return 0
    
    # Get players already in the match (Source of Truth: match_participations)
    parts_res = supabase.table("match_participations").select("player_id").eq("match_id", match_id).execute()
    players_in_match = {row["player_id"] for row in (parts_res.data or [])}
    
    # Get players already invited to this match
    existing_invites = supabase.table("match_invites").select("player_id").eq("match_id", match_id).execute()
    already_invited = {inv["player_id"] for inv in (existing_invites.data or [])}
    
    # Current time for mute check
    now = get_now_utc()
    
    candidates = []
    print(f"[DEBUG] Processing {len(candidates_res.data)} member candidates...")
    for p in candidates_res.data:
        p_id = p["player_id"]
        p_name = p.get("name", "Unknown")
        
        # Filter by group if set
        if group_member_ids is not None:
            if p_id not in group_member_ids:
                continue

        print(f"[DEBUG] Checking candidate {p_name} ({p_id})")

        # Exclude players already in match
        if p_id in players_in_match:
            print(f"[DEBUG]   Excluded: Already in match")
            continue
        
        # Exclude already invited
        if p_id in already_invited:
            print(f"[DEBUG]   Excluded: Already invited")
            continue
        
        # Check if player is muted
        muted_until = p.get("muted_until")
        if muted_until:
            try:
                muted_dt = parse_iso_datetime(muted_until).replace(tzinfo=None)
                if muted_dt > now:
                    print(f"Skipping {p_name} - muted until {muted_until}")
                    continue
            except:
                pass
        
        # Skip level/gender filtering if skip_filters is True
        if not skip_filters:
            # Check skill range
            player_level = p.get("adjusted_skill_level") or p.get("declared_skill_level") or 3.5
            if player_level < level_min or player_level > level_max:
                print(f"[DEBUG]   Excluded: Level {player_level} out of range")
                continue
            
            # Check gender preference
            if gender_preference and gender_preference != "mixed":
                player_gender = (p.get("gender") or "").lower()
                if gender_preference == "male" and player_gender != "male":
                    print(f"[DEBUG]   Excluded: Gender {player_gender} mismatch")
                    continue
                if gender_preference == "female" and player_gender != "female":
                    print(f"[DEBUG]   Excluded: Gender {player_gender} mismatch")
                    continue
        
        print(f"[DEBUG]   Accepted: {p_name}")
        candidates.append(p)
    
    # 3. Rank Candidates using Scoring Engine
    from scoring_engine import rank_candidates
    
    # Construct match details for scoring
    # Note: match keys in DB are level_range_min/max, scoring engine expects level_min/max
    score_match_details = {
        "level_min": match.get("level_range_min"),
        "level_max": match.get("level_range_max"),
        "gender_preference": match.get("gender_preference")
    }
    
    # Rank them!
    # This injects '_invite_score' and '_score_breakdown' into each candidate dict
    sorted_candidates = rank_candidates(candidates, score_match_details)
    
    print(f"Found {len(sorted_candidates)} eligible candidates (Sorted by Score).")
    if sorted_candidates:
        top = sorted_candidates[0]
        print(f"Top candidate: {top['name']} - Score: {top.get('_invite_score')}")

    # 4. Determine how many to invite
    # When skip_filters is True (group invite), invite ALL group members
    if skip_filters:
        invite_limit = len(sorted_candidates)  # Invite everyone in the group
    elif max_invites is not None:
        invite_limit = max_invites
    else:
        # Use club setting or default BATCH_SIZE
        batch_size = settings.get("initial_batch_size", BATCH_SIZE) if club_id else BATCH_SIZE
        invite_limit = batch_size
    
    # 5. Send invites
    invite_count = 0
    expires_at = (get_now_utc() + timedelta(minutes=invite_timeout_minutes)).isoformat()
    
    for p in sorted_candidates[:invite_limit]:
        invite_status = "pending_sms" if is_quiet else "sent"
        
        # Use RPC to atomically check and insert
        # This prevents race conditions and ensures data integrity
        rpc_params = {
            "p_match_id": match_id,
            "p_player_id": p["player_id"],
            "p_status": invite_status,
            "p_batch_number": batch_number,
            "p_sent_at": get_now_utc().isoformat(),
            "p_expires_at": expires_at if not skip_filters else None,
            "p_invite_score": p.get("_invite_score"),
            "p_score_breakdown": p.get("_score_breakdown")
        }
        
        try:
            rpc_res = supabase.rpc("attempt_insert_invite", rpc_params).execute()
            result = rpc_res.data
            
            if result == 'SUCCESS':
                if not is_quiet:
                    sms_msg = _build_invite_sms(match, requester, club_name)
                    send_sms(p["phone_number"], sms_msg, club_id=club_id)
                    
                    # CLEAR STATE so they don't get stuck in old feedback loops
                    clear_user_state(p["phone_number"])
                
                invite_count += 1
                print(f"{'Created' if is_quiet else 'Invited'} {p['name']} ({p['phone_number']}) - Status: {invite_status}")
            
            elif result == 'MATCH_FULL':
                print(f"Skipping {p['name']} - Match is full.")
                # We can probably break here if strict, but maybe other spots open? 
                # For now, let's just continue/break based on logic.
                # If match is full, we should stop inviting people.
                break 
                
            elif result == 'ALREADY_INVITED':
                print(f"Skipping {p['name']} - Already invited.")
                
            elif result == 'ALREADY_IN_MATCH':
                print(f"Skipping {p['name']} - Already in match.")
                
            else:
                print(f"RPC returned unknown code: {result}")
                
        except Exception as e:
            print(f"Error inviting {p['name']}: {e}")
            continue
    
    # If this is the first batch and we couldn't find at least 3 people
    # (to make 4 total), check if we should notify about a deadpool.
    if batch_number == 1 and not skip_filters and invite_count < 3:
        _check_match_deadpool(match_id)
        
    return invite_count


def _build_invite_sms(match: dict, requester: dict, club_name: str) -> str:
    """Helper to build the SMS invite body."""
    if match["status"] == "voting":
        options = match.get("voting_options", [])
        opt_str = ""
        club_id = match.get("club_id")
        for i, opt in enumerate(options):
            dt = parse_iso_datetime(opt)
            # Use format_sms_datetime for consistent localized formatting
            f_dt = format_sms_datetime(dt, club_id=club_id)
            # Extract just the time part for voting options if possible, or use full string
            opt_str += f"{chr(65+i)}) {f_dt}\n"
        
        # Get day of week from first option
        day_str = parse_iso_datetime(options[0]).strftime('%A')
        if club_id:
            try:
                tz = pytz.timezone(get_club_timezone(club_id))
                day_str = parse_iso_datetime(options[0]).astimezone(tz).strftime('%A')
            except:
                pass

        organizer_name = requester['name'] if requester else "An organizer"
        return (
            f"🎾 {club_name}: {organizer_name} wants to play on {day_str}.\n"
            f"Options:\n{opt_str}"
            f"Reply with letter(s) (e.g. 'A' or 'AB') to vote."
        )
    else:
        # Format time nicely
        try:
            scheduled_dt = parse_iso_datetime(match['scheduled_time'])
            time_str = format_sms_datetime(scheduled_dt, club_id=match.get("club_id"))
        except:
            time_str = match['scheduled_time']
        
        organizer_name = requester['name'] if requester else "An organizer"
        skill_str = f" ({requester.get('declared_skill_level', '')})" if requester and requester.get('declared_skill_level') else ""

        return (
            f"🎾 {club_name}: {organizer_name}{skill_str} wants to play "
            f"{time_str}.\n"
            f"Reply YES to join, NO to decline, or MUTE to pause invites today."
        )


def invite_replacement_player(match_id: str, count: int = 1):
    """
    Invite replacement player(s) when someone declines.
    Called immediately when a player says NO.
    """
    # Get the current batch number
    latest_invite = supabase.table("match_invites").select("batch_number").eq("match_id", match_id).order("sent_at", desc=True).limit(1).execute()
    batch_number = 1
    if latest_invite.data:
        batch_number = latest_invite.data[0].get("batch_number", 1)
    
    sent = find_and_invite_players(match_id, batch_number=batch_number, max_invites=count)
    
    # If we couldn't find enough players, check for deadpool (group-scoped only)
    if sent < count:
        _check_match_deadpool(match_id)
        
    return sent


def process_batch_refills():
    """
    Find invites that have timed out (15 minutes) but haven't triggered a refill yet.
    Triggers the next batch while keeping existing ones valid.
    Called by cron job every 5 minutes.
    """
    print("Processing batch refills...")
    
    from logic_utils import get_now_utc_iso
    now = get_now_utc_iso()
    
    # Find sent invites that have passed their expires_at and haven't been refilled
    # We only refill if refilled_at is NULL
    stale_invites = supabase.table("match_invites").select("invite_id, match_id, player_id, batch_number")\
        .eq("status", "sent")\
        .not_.is_("match_id", "null")\
        .filter("expires_at", "lt", now)\
        .is_("refilled_at", "null")\
        .execute()
    
    if not stale_invites.data:
        print("No stale invites needing refill found.")
        return 0
    
    print(f"Found {len(stale_invites.data)} stale invites.")
    
    # Group by match and find the latest batch number per match
    matches_to_refill = {}
    invites_to_mark_refilled = []
    
    for inv in stale_invites.data:
        match_id = inv["match_id"]
        # Skip if quiet hours for this match's club
        match_res = supabase.table("matches").select("club_id").eq("match_id", match_id).execute()
        if match_res.data:
            club_id = match_res.data[0].get("club_id")
            if is_quiet_hours(club_id):
                continue
        
        if match_id not in matches_to_refill:
            matches_to_refill[match_id] = 0
            
        matches_to_refill[match_id] += 1
        invites_to_mark_refilled.append(inv["invite_id"])
    
    if not matches_to_refill:
        return 0

    # Mark these invites as refilled so they don't trigger again
    if invites_to_mark_refilled:
        supabase.table("match_invites").update({"refilled_at": get_now_utc().isoformat()})\
            .in_("invite_id", invites_to_mark_refilled).execute()
    
    # Send refill invites for each affected match
    total_new_invites = 0
    for match_id, stale_count in matches_to_refill.items():
        # Check if match is still pending
        match_res = supabase.table("matches").select("status").eq("match_id", match_id).execute()
        if match_res.data and match_res.data[0]["status"] in ["pending", "voting"]:
            # Trigger next batch
            latest_inv = supabase.table("match_invites").select("batch_number").eq("match_id", match_id).order("sent_at", desc=True).limit(1).execute()
            next_batch = (latest_inv.data[0]["batch_number"] + 1) if latest_inv.data else 1
            
            new_invites = find_and_invite_players(match_id, batch_number=next_batch, max_invites=stale_count)
            total_new_invites += new_invites
            print(f"Triggered batch {next_batch} for match {match_id} ({new_invites} new invites)")
            
            if new_invites < stale_count:
                _check_match_deadpool(match_id)
    
    return total_new_invites


def _check_match_deadpool(match_id: str):
    """
    Checks if a match has reached a dead end (no more eligible players in group).
    If so, notifies the originator.
    """
    print(f"Checking for deadpool on match {match_id}...")
    
    # 1. Fetch match details
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_res.data:
        return
    match = match_res.data[0]
    
    if match["status"] not in ["pending", "voting"]:
        return

    target_group_id = match.get("target_group_id")

    # 2. Count current players and active invites
    parts_res = supabase.table("match_participations").select("player_id").eq("match_id", match_id).execute()
    players_in_match_count = len(parts_res.data or [])
    
    active_invites = supabase.table("match_invites").select("invite_id").eq("match_id", match_id).eq("status", "sent").execute()
    active_count = len(active_invites.data or [])
    
    needed = 4 - players_in_match_count - active_count
    if needed <= 0:
        return

    # 3. Check remaining eligible members in group
    # Get group members
    group_res = supabase.table("group_memberships").select("player_id").eq("group_id", target_group_id).execute()
    group_member_ids = {row["player_id"] for row in (group_res.data or [])}
    
    # Get all involvements (in match, invited, or declined/expired)
    involvement_res = supabase.table("match_invites").select("player_id, status").eq("match_id", match_id).execute()
    already_involved = {inv["player_id"] for inv in (involvement_res.data or [])}
    already_involved.update({row["player_id"] for row in (parts_res.data or [])})
    
    pool = [pid for pid in group_member_ids if pid not in already_involved]
    
    if len(pool) < needed:
        print(f"Match {match_id} in deadpool! Needed {needed}, only {len(pool)} left in group.")
        
        # Notify originator
        originator_id = match.get("originator_id")
        if not originator_id:
            return
            
        orig_res = supabase.table("players").select("*").eq("player_id", originator_id).execute()
        if not orig_res.data:
            return
        originator = orig_res.data[0]
        
        # Get group name
        g_name_res = supabase.table("player_groups").select("name").eq("group_id", target_group_id).maybe_single().execute()
        group_name = g_name_res.data["name"] if g_name_res.data else "the group"
        
        # Format time
        try:
            scheduled_dt = parse_iso_datetime(match['scheduled_time'])
            time_str = format_sms_datetime(scheduled_dt, club_id=club_id)
        except:
            time_str = "your requested time"

        # Get club name
        club_name = "the club"
        club_id = match.get("club_id")
        if club_id:
            club_res = supabase.table("clubs").select("name").eq("club_id", club_id).maybe_single().execute()
            if club_res.data:
                club_name = club_res.data["name"]

        if target_group_id:
            # Group-to-Club broadening message
            sms_msg = msg.MSG_DEADPOOL_NOTIFICATION.format(
                club_name=club_name,
                group_name=group_name,
                time=time_str
            )
        else:
            # Club-wide level range broadening message
            sms_msg = msg.MSG_DEADPOOL_CLUB_WIDE.format(
                club_name=club_name,
                time=time_str
            )
        
        send_sms(originator["phone_number"], sms_msg, club_id=club_id)
        set_user_state(originator["phone_number"], msg.STATE_DEADPOOL_REFILL, {"match_id": match_id})


def process_pending_matches():
    """
    1. Finds matches that are pending/voting but have NO invites at all and starts them.
    2. Finds 'pending_sms' invites and dispatches them if quiet hours are over.
    """
    print("Processing pending invitations and quiet-hour catch-ups...")
    
    # --- Part 1: Dispatch pending_sms invites ---
    # Find all pending_sms invites
    pending_invites = supabase.table("match_invites").select("*, players(phone_number, name)")\
        .eq("status", "pending_sms")\
        .not_.is_("match_id", "null")\
        .execute()
    
    total_dispatched = 0
    if pending_invites.data:
        # Group by match to avoid repeated match/requester lookups
        matches_cache = {}
        for inv in pending_invites.data:
            match_id = inv["match_id"]
            
            # Fetch match/club details if not in cache
            if match_id not in matches_cache:
                m_res = supabase.table("matches").select("*, clubs(name)").eq("match_id", match_id).execute()
                if not m_res.data: continue
                m_data = m_res.data[0]
                club_id = m_data.get("club_id")
                
                # Check quiet hours
                if is_quiet_hours(club_id):
                    continue
                
                # Get requester - Phase 4 use match_participations
                from logic_utils import get_match_participants
                parts = get_match_participants(match_id)
                req_id = parts["team_1"][0] if parts["team_1"] else m_data.get("originator_id")
                
                requester = None
                if req_id:
                    req_res = supabase.table("players").select("*").eq("player_id", req_id).execute()
                    if req_res.data:
                        requester = req_res.data[0]
                
                matches_cache[match_id] = {
                    "match": m_data,
                    "requester": requester,
                    "club_name": m_data.get("clubs", {}).get("name") or "the club"
                }

            # If we reach here, we can dispatch
            m_info = matches_cache[match_id]
            p_data = inv.get("players")
            if not p_data: continue

            # Build and send SMS
            sms_msg = _build_invite_sms(m_info["match"], m_info["requester"], m_info["club_name"])
            if send_sms(p_data["phone_number"], sms_msg, club_id=m_info["match"].get("club_id")):
                # Update status to 'sent' and refresh expires_at
                # Use club settings for timeout
                invite_timeout = INVITE_TIMEOUT_MINUTES
                c_id = m_info["match"].get("club_id")
                if c_id:
                    club_res = supabase.table("clubs").select("settings").eq("club_id", c_id).execute()
                    if club_res.data:
                        invite_timeout = (club_res.data[0].get("settings") or {}).get("invite_timeout_minutes", INVITE_TIMEOUT_MINUTES)
                
                new_expires_at = (get_now_utc() + timedelta(minutes=invite_timeout)).isoformat()
                
                supabase.table("match_invites").update({
                    "status": "sent",
                    "sent_at": get_now_utc().isoformat(),
                    "expires_at": new_expires_at
                }).eq("invite_id", inv["invite_id"]).execute()
                
                clear_user_state(p_data["phone_number"])
                total_dispatched += 1
                
                # Notify originator once per match if this is the first dispatch
                # (Can implement a flag in match or just check if it's the first invite in this batch)

    # --- Part 2: Start matches with NO invites ---
    matches = supabase.table("matches").select("match_id, status")\
        .in_("status", ["pending", "voting"])\
        .not_.is_("match_id", "null")\
        .not_.is_("scheduled_time", "null")\
        .execute()
    
    total_new_starts = 0
    if matches.data:
        for match in matches.data:
            match_id = match["match_id"]
            # Check if there are any invites at all
            all_inv_res = supabase.table("match_invites").select("invite_id").eq("match_id", match_id).execute()
            if not all_inv_res.data:
                # No invites, try to start
                invites = find_and_invite_players(match_id, batch_number=1)
                total_new_starts += (1 if invites > 0 else 0)

    print(f"Catch-up complete: {total_dispatched} SMS dispatched, {total_new_starts} new matches started.")
    return total_dispatched + total_new_starts
