from database import supabase
from twilio_client import send_sms
from datetime import datetime, timedelta
from logic_utils import is_quiet_hours, parse_iso_datetime
from redis_client import clear_user_state


# Configuration
BATCH_SIZE = 6  # Number of invites to send at a time
INVITE_TIMEOUT_MINUTES = 15  # Time before invite expires


def find_and_invite_players(match_id: str, batch_number: int = 1, max_invites: int = None, skip_filters: bool = False):
    """
    Finds compatible players for a match and sends SMS invites in batches.
    
    Args:
        match_id: The match to find players for
        batch_number: Which batch this is (for tracking)
        max_invites: Override for number of invites (used for replacements)
        skip_filters: If True, skip level/gender filtering (used for group invites)
    
    Returns:
        Number of invites sent
    """
    print(f"Finding players for match {match_id} (batch {batch_number}, skip_filters={skip_filters})...")
    
    # 1. Fetch the match details
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_res.data:
        print("Match not found.")
        return 0
    match = match_res.data[0]
    club_id = match.get("club_id")

    # Proactive invites should be blocked during quiet hours
    if is_quiet_hours(club_id):
        print(f"[QUIET HOURS] Skipping proactive invites for club {club_id}")
        return 0
    
    # Check if match is still pending/active
    if match["status"] not in ["pending", "voting"]:
        print(f"Match status is {match['status']}, not inviting.")
        return 0
    
    # Get requester (first player in team 1)
    requester_id = match["team_1_players"][0]
    player_res = supabase.table("players").select("*").eq("player_id", requester_id).execute()
    if not player_res.data:
        print("Requester not found.")
        return 0
    requester = player_res.data[0]
    
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
        target_level = requester.get("adjusted_skill_level") or requester.get("declared_skill_level") or 3.5
        level_min = target_level - 0.25
        level_max = target_level + 0.25
    
    # 2. Find active players in the club
    candidates_res = supabase.table("players").select("*").eq("club_id", club_id).eq("active_status", True).execute()
    
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
    
    # Get players already in the match
    players_in_match = set(match.get("team_1_players", []) + match.get("team_2_players", []))
    
    # Get players already invited to this match
    existing_invites = supabase.table("match_invites").select("player_id").eq("match_id", match_id).execute()
    already_invited = {inv["player_id"] for inv in (existing_invites.data or [])}
    
    # Current time for mute check
    now = datetime.utcnow()
    
    candidates = []
    for p in candidates_res.data:
        # Filter by group if set
        if group_member_ids is not None:
            if p["player_id"] not in group_member_ids:
                continue

        # Exclude players already in match
        if p["player_id"] in players_in_match:
            continue
        
        # Exclude already invited
        if p["player_id"] in already_invited:
            continue
        
        # Check if player is muted
        muted_until = p.get("muted_until")
        if muted_until:
            try:
                muted_dt = parse_iso_datetime(muted_until).replace(tzinfo=None)
                if muted_dt > now:
                    print(f"Skipping {p['name']} - muted until {muted_until}")
                    continue
            except:
                pass
        
        # Skip level/gender filtering if skip_filters is True
        if not skip_filters:
            # Check skill range
            player_level = p.get("adjusted_skill_level") or p.get("declared_skill_level") or 3.5
            if player_level < level_min or player_level > level_max:
                continue
            
            # Check gender preference
            if gender_preference and gender_preference != "mixed":
                player_gender = (p.get("gender") or "").lower()
                if gender_preference == "male" and player_gender != "male":
                    continue
                if gender_preference == "female" and player_gender != "female":
                    continue
        
        # Note: availability_preferences check removed - was blocking players without this set
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
        invite_limit = BATCH_SIZE
    
    # 5. Send invites
    invite_count = 0
    expires_at = (datetime.utcnow() + timedelta(minutes=invite_timeout_minutes)).isoformat()
    
    for p in sorted_candidates[:invite_limit]:
        # Create Invite with expiration and SCORES
        invite_data = {
            "match_id": match_id,
            "player_id": p["player_id"],
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at,
            "batch_number": batch_number,
            "invite_score": p.get("_invite_score"),
            "score_breakdown": p.get("_score_breakdown")
        }
        supabase.table("match_invites").insert(invite_data).execute()
        
        # Send SMS
        if match["status"] == "voting":
            options = match.get("voting_options", [])
            opt_str = ""
            for i, opt in enumerate(options):
                dt = parse_iso_datetime(opt)
                time_str = dt.strftime("%H:%M")
                opt_str += f"{chr(65+i)}) {time_str}\n"
            
            sms_msg = (
                f"🎾 {club_name}: {requester['name']} wants to play on {parse_iso_datetime(options[0]).strftime('%A')}.\n"
                f"Options:\n{opt_str}"
                f"Reply with letter(s) (e.g. 'A' or 'AB') to vote."
            )
        else:
            # Format time nicely
            try:
                scheduled_dt = parse_iso_datetime(match['scheduled_time'])
                time_str = scheduled_dt.strftime("%a, %b %d at %I:%M %p")
            except:
                time_str = match['scheduled_time']
            
            sms_msg = (
                f"🎾 {club_name}: {requester['name']} ({requester['declared_skill_level']}) wants to play "
                f"{time_str}.\n"
                f"Reply YES to join, NO to decline, or MUTE to pause invites today."
            )
        
        send_sms(p["phone_number"], sms_msg)
        
        # CLEAR STATE so they don't get stuck in old feedback loops
        clear_user_state(p["phone_number"])
        
        invite_count += 1
        print(f"Invited {p['name']} ({p['phone_number']}) - Score: {p.get('_invite_score')}")
    
    return invite_count


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
    
    return find_and_invite_players(match_id, batch_number=batch_number, max_invites=count)


def process_expired_invites():
    """
    Process invites that have timed out (15 minutes).
    Called by cron job every 5 minutes.
    """
    print("Processing expired invites...")
    
    now = datetime.utcnow().isoformat()
    
    # Find expired sent invites
    # Use explicit UTC comparison if possible, or ensure 'now' is interpreted correctly
    expired = supabase.table("match_invites").select("invite_id, match_id, player_id").eq("status", "sent").filter("expires_at", "lt", now).execute()
    
    if not expired.data:
        print("No expired invites found.")
        return 0
    
    print(f"Found {len(expired.data)} expired invites.")
    
    # Group by match
    matches_to_refill = {}
    for inv in expired.data:
        match_id = inv["match_id"]
        if match_id not in matches_to_refill:
            matches_to_refill[match_id] = 0
        matches_to_refill[match_id] += 1
        
        # Mark as expired
        supabase.table("match_invites").update({"status": "expired"}).eq("invite_id", inv["invite_id"]).execute()
    
    # Send replacement invites for each affected match
    total_new_invites = 0
    for match_id, expired_count in matches_to_refill.items():
        # Check if match is still pending
        match_res = supabase.table("matches").select("status").eq("match_id", match_id).execute()
        if match_res.data and match_res.data[0]["status"] in ["pending", "voting"]:
            # Get current batch number
            latest_invite = supabase.table("match_invites").select("batch_number").eq("match_id", match_id).order("sent_at", desc=True).limit(1).execute()
            batch_number = 1
            if latest_invite.data:
                batch_number = latest_invite.data[0].get("batch_number", 1) + 1
            
            new_invites = find_and_invite_players(match_id, batch_number=batch_number, max_invites=expired_count)
            total_new_invites += new_invites
            print(f"Sent {new_invites} replacement invites for match {match_id}")
    
    return total_new_invites


def process_pending_matches():
    """
    Find matches that are pending/voting but have no active invites
    (likely due to quiet hours or initial creation) and send invites.
    """
    print("Processing pending matches for invites...")
    
    # Find matches in pending/voting status
    matches = supabase.table("matches").select("match_id, status").in_("status", ["pending", "voting"]).execute()
    
    if not matches.data:
        return 0
        
    total_invites = 0
    for match in matches.data:
        match_id = match["match_id"]
        
        # Check if there are any active (sent) invites
        active_invites = supabase.table("match_invites").select("invite_id").eq("match_id", match_id).eq("status", "sent").execute()
        
        if not active_invites.data:
            # If no active invites, try to invite players
            # We use batch 1 since it's likely the first attempt or restart
            invites = find_and_invite_players(match_id, batch_number=1)
            total_invites += invites
            if invites > 0:
                print(f"Sent {invites} catch-up invites for match {match_id}")
                
    return total_invites
