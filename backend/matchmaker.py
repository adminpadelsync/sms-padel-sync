from database import supabase
from twilio_client import send_sms
from datetime import datetime, timedelta

def find_and_invite_players(match_id: str):
    """
    Finds compatible players for a match and sends SMS invites.
    """
    print(f"Finding players for match {match_id}...")
    
    # 1. Fetch the match details
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_res.data:
        print("Match not found.")
        return
    match = match_res.data[0]
    
    # Get requester (first player in team 1)
    requester_id = match["team_1_players"][0]
    player_res = supabase.table("players").select("*").eq("player_id", requester_id).execute()
    if not player_res.data:
        print("Requester not found.")
        return
    requester = player_res.data[0]
    
    target_level = requester["adjusted_skill_level"]
    club_id = match["club_id"]
    
    # 2. Find active players in the club with similar skill (+/- 0.25)
    # Note: Supabase/PostgREST doesn't support complex OR/AND logic easily in one query for ranges
    # We'll fetch candidates and filter in Python for MVP
    candidates_res = supabase.table("players").select("*").eq("club_id", club_id).eq("active_status", True).execute()
    
    candidates = []
    for p in candidates_res.data:
        # Exclude requester
        if p["player_id"] == requester_id:
            continue
            
        # Check skill range
        level_diff = abs(p["adjusted_skill_level"] - target_level)
        if level_diff > 0.25:
            continue
            
        # Check availability (Simple text match for MVP)
        # In real app, this would be structured data
        # We'll assume if they have availability set, they are potential candidates
        if not p.get("availability_preferences"):
            continue
            
        candidates.append(p)
        
    print(f"Found {len(candidates)} candidates.")
    
    # 3. Invite up to 10 players (limit for MVP)
    # In production, we'd prioritize by recency, compatibility, etc.
    invite_count = 0
    for p in candidates[:10]:
        # Check if already invited
        existing_invite = supabase.table("match_invites").select("*").eq("match_id", match_id).eq("player_id", p["player_id"]).execute()
        if existing_invite.data:
            continue
            
        # Create Invite
        invite_data = {
            "match_id": match_id,
            "player_id": p["player_id"],
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat()
        }
        supabase.table("match_invites").insert(invite_data).execute()
        
        # Send SMS
        if match["status"] == "voting":
            options = match.get("voting_options", [])
            opt_str = ""
            for i, opt in enumerate(options):
                # Format: A) 14:00
                dt = datetime.fromisoformat(opt)
                time_str = dt.strftime("%H:%M")
                opt_str += f"{chr(65+i)}) {time_str}\n"
            
            msg = (
                f"PADEL MATCH: {requester['name']} wants to play on {datetime.fromisoformat(options[0]).strftime('%A')}.\n"
                f"Options:\n{opt_str}"
                f"Reply with letter(s) (e.g. 'A' or 'AB') to vote."
            )
        else:
            msg = (
                f"PADEL MATCH: {requester['name']} ({requester['declared_skill_level']}) wants to play "
                f"at {match['scheduled_time']}. "
                f"Reply YES to join or NO to decline."
            )
        send_sms(p["phone_number"], msg)
        invite_count += 1
        print(f"Invited {p['name']} ({p['phone_number']})")
        
    return invite_count
