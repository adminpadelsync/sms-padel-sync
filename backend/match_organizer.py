from typing import List, Optional
from datetime import datetime
from database import supabase
from logic_utils import parse_iso_datetime, get_now_utc

def _get_club_name(club_id: str) -> str:
    """Helper to get club name from ID."""
    if not club_id:
        return "the club"
    res = supabase.table("clubs").select("name").eq("club_id", club_id).execute()
    if res.data:
        return res.data[0]["name"]
    return "the club"

def get_player_recommendations(
    club_id: str,
    target_level: float,
    gender_preference: Optional[str] = None,
    exclude_player_ids: List[str] = [],
    limit: int = 10
) -> List[dict]:
    """
    Get recommended players for a match based on level and gender.
    
    Args:
        club_id: The club to search in
        target_level: The target skill level (e.g. 3.5)
        gender_preference: Optional 'male', 'female', or 'mixed' (any)
        exclude_player_ids: List of player IDs to exclude (e.g. host)
        limit: Max number of recommendations to return
        
    Returns:
        List of player dictionaries
    """
    
    # Base query
    # 1. Fetch player IDs for this club from club_members
    members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
    member_ids = [m["player_id"] for m in (members_res.data or [])]
    
    if not member_ids:
        return []

    # 2. Fetch data for these players
    query = supabase.table("players")\
        .select("*")\
        .in_("player_id", member_ids)\
        .eq("active_status", True)
        
    # Filter by level (allow +/- 0.5 range)
    # Note: Supabase doesn't support complex OR logic easily in one chain, 
    # so we'll fetch a slightly wider range and filter in python if needed,
    # or just look for exact matches and adjacent levels.
    # For now, let's try to find players within 0.5 of target level.
    # Since we can't do "between" easily with the client sometimes, let's use gte/lte
    
    min_level = target_level - 0.5
    max_level = target_level + 0.5
    
    query = query.gte("declared_skill_level", min_level)\
                 .lte("declared_skill_level", max_level)
    
    # Filter by gender if specified and not 'mixed'
    if gender_preference and gender_preference.lower() != 'mixed':
        query = query.eq("gender", gender_preference)
        
    # Execute query
    try:
        print(f"Executing query for club_id: {club_id}, level: {min_level}-{max_level}, gender: {gender_preference}")
        result = query.execute()
        players = result.data
        print(f"Found {len(players)} players")
    except Exception as e:
        print(f"Error executing query: {e}")
        # Return empty list or re-raise depending on desired behavior
        # For debugging, let's re-raise to see it in the API response if possible, 
        # or return empty list to avoid crashing
        print(f"Full query details: {query}") 
        raise e
    
    # Post-processing
    recommendations = []
    
    for player in players:
        # Skip excluded players
        if player['player_id'] in exclude_player_ids:
            continue
            
        # Calculate a simple match score (lower is better)
        level_diff = abs(float(player['declared_skill_level']) - target_level)
        
        # Add to list
        recommendations.append({
            **player,
            'match_score': level_diff
        })
        
    # Sort by match score (closest level first)
    recommendations.sort(key=lambda x: x['match_score'])
    
    return recommendations[:limit]

def initiate_match_outreach(
    club_id: str,
    player_ids: List[str],
    scheduled_time: str,
    initial_player_ids: List[str] = [],
    originator_id: Optional[str] = None
) -> dict:
    """
    Create a match and send invites to selected players.
    
    Args:
        club_id: The club ID
        player_ids: List of player IDs to invite (will receive SMS)
        scheduled_time: ISO format timestamp string
        initial_player_ids: List of player IDs already committed (no SMS sent)
        
    Returns:
        Created match dictionary
    """
    
    # 1. Create the match record with initial players already in team_1
    match_data = {
        "club_id": club_id,
        "scheduled_time": scheduled_time,
        "status": "pending",
        "team_1_players": initial_player_ids,  # Start with committed players
        "team_2_players": [],
        "originator_id": originator_id or (initial_player_ids[0] if initial_player_ids else None),
        "created_at": get_now_utc().isoformat()
    }
    
    match_result = supabase.table("matches").insert(match_data).execute()
    if not match_result.data:
        raise Exception("Failed to create match")
        
    match = match_result.data[0]
    match_id = match['match_id']
    
    # 2. Trigger outreach via matchmaker (respects quiet hours)
    from matchmaker import find_and_invite_players
    find_and_invite_players(
        match_id=match_id, 
        target_player_ids=player_ids, 
        batch_number=1, 
        skip_filters=True # Use specific players selected by Admin
    )

    print(f"Match created with {len(initial_player_ids)} initial players already committed")
    
    return match

def get_match_details(match_id: str) -> dict:
    """
    Get detailed match information including player names.
    
    Args:
        match_id: The match ID
        
    Returns:
        Match dictionary with player details
    """
    # Get match
    match_result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_result.data:
        raise Exception(f"Match {match_id} not found")
    
    match = match_result.data[0]
    
    # Get player details for team 1
    team_1_players = []
    if match.get('team_1_players'):
        for player_id in match['team_1_players']:
            player_result = supabase.table("players").select("*").eq("player_id", player_id).execute()
            if player_result.data:
                team_1_players.append(player_result.data[0])
    
    # Get player details for team 2
    team_2_players = []
    if match.get('team_2_players'):
        for player_id in match['team_2_players']:
            player_result = supabase.table("players").select("*").eq("player_id", player_id).execute()
            if player_result.data:
                team_2_players.append(player_result.data[0])
    
    # Add player details to match
    match['team_1_player_details'] = team_1_players
    match['team_2_player_details'] = team_2_players
    
    # Get originator details if exists
    if match.get('originator_id'):
        orig_res = supabase.table("players").select("*").eq("player_id", match['originator_id']).execute()
        if orig_res.data:
            match['originator_details'] = orig_res.data[0]
    
    return match

def get_match_invites(match_id: str) -> list:
    """
    Get all invites for a match with player details.
    
    Args:
        match_id: The match ID
        
    Returns:
        List of invite dictionaries with player details
    """
    # Get all invites for this match
    invites_result = supabase.table("match_invites").select("*").eq("match_id", match_id).order("sent_at").execute()
    
    if not invites_result.data:
        return []
    
    # Get player details for each invite
    result = []
    for invite in invites_result.data:
        player_result = supabase.table("players").select(
            "player_id, name, declared_skill_level, phone_number"
        ).eq("player_id", invite["player_id"]).execute()
        
        if player_result.data:
            result.append({
                **invite,
                "player": player_result.data[0]
            })
        else:
            result.append(invite)
    
    return result

def send_match_invites(match_id: str, player_ids: List[str]) -> List[dict]:
    """
    Send invites to additional players for an existing match.
    Includes info about already confirmed players in the message.
    
    Args:
        match_id: The match ID
        player_ids: List of player IDs to invite
        
    Returns:
        List of created invite dictionaries
    """
    from twilio_client import send_sms
    
    # Get match details
    match_result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_result.data:
        raise Exception(f"Match {match_id} not found")
    
    match = match_result.data[0]
    
    # Format date for SMS
    try:
        dt = parse_iso_datetime(match['scheduled_time'])
        formatted_time = dt.strftime("%a, %b %d at %I:%M %p")
    except:
        formatted_time = match['scheduled_time']
    
    # Get already confirmed players
    confirmed_player_ids = (match.get('team_1_players') or []) + (match.get('team_2_players') or [])
    confirmed_players_text = ""
    if confirmed_player_ids:
        confirmed_result = supabase.table("players").select("name, declared_skill_level").in_("player_id", confirmed_player_ids).execute()
        if confirmed_result.data:
            player_list = [f"{p['name']} ({p['declared_skill_level']})" for p in confirmed_result.data]
            confirmed_players_text = "Already in:\n" + "\n".join([f"• {name}" for name in player_list]) + "\n\n"
    
    # Create invites
    invites = []
    for pid in player_ids:
        invites.append({
            "match_id": match_id,
            "player_id": pid,
            "status": "sent",
            "sent_at": get_now_utc().isoformat()
        })
    
    if invites:
        supabase.table("match_invites").insert(invites).execute()
    
    # Calculate spots left
    spots_left = 4 - len(confirmed_player_ids)
    spots_text = f"{spots_left} spot{'s' if spots_left != 1 else ''} left"
    
    # Fetch player details and send SMS
    players_result = supabase.table("players").select("player_id, phone_number, name").in_("player_id", player_ids).execute()
    
    success_count = 0
    for p in players_result.data:
        phone = p.get('phone_number')
        name = p.get('name')
        if phone:
            club_name = _get_club_name(match['club_id'])
            body = (
                f"🎾 {club_name}: NEW MATCH INVITE!\n"
                f"{formatted_time}\n"
                f"({spots_text})\n\n"
                f"{confirmed_players_text}"
                f"Reply YES to join, NO to decline."
            )
            
            if send_sms(phone, body, club_id=match['club_id']):
                success_count += 1
                print(f"Sent invite to {name} ({phone})")
            else:
                print(f"Failed to send invite to {name} ({phone})")
    
    print(f"Sent SMS to {success_count}/{len(player_ids)} players for match {match_id}")
    
    return invites

def update_match(match_id: str, updates: dict) -> dict:
    """
    Update match fields.
    
    Args:
        match_id: The match ID
        updates: Dictionary of fields to update (e.g., {'scheduled_time': '...', 'status': '...'})
        
    Returns:
        Updated match dictionary
    """
    result = supabase.table("matches").update(updates).eq("match_id", match_id).execute()
    if not result.data:
        raise Exception(f"Failed to update match {match_id}")
    
    return result.data[0]

def add_player_to_match(match_id: str, player_id: str, team: int) -> dict:
    """
    Add a player to a match team.
    
    Args:
        match_id: The match ID
        player_id: The player ID to add
        team: Team number (1 or 2)
        
    Returns:
        Updated match dictionary
    """
    # Get current match
    match_result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_result.data:
        raise Exception(f"Match {match_id} not found")
    
    match = match_result.data[0]
    
    # Add player to appropriate team
    if team == 1:
        team_players = match.get('team_1_players', [])
        if player_id not in team_players:
            team_players.append(player_id)
        updates = {'team_1_players': team_players}
    elif team == 2:
        team_players = match.get('team_2_players', [])
        if player_id not in team_players:
            team_players.append(player_id)
        updates = {'team_2_players': team_players}
    else:
        raise Exception("Team must be 1 or 2")
    
    # Update match
    return update_match(match_id, updates)

def remove_player_from_match(match_id: str, player_id: str) -> dict:
    """
    Remove a player from a match.
    If match was confirmed and removing drops below 4 players, revert to pending.
    
    Args:
        match_id: The match ID
        player_id: The player ID to remove
        
    Returns:
        Updated match dictionary
    """
    # Get current match
    match_result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_result.data:
        raise Exception(f"Match {match_id} not found")
    
    match = match_result.data[0]
    team_1_players = match.get('team_1_players', [])
    team_2_players = match.get('team_2_players', [])
    updates = {}
    
    # Remove from team 1 if present
    if player_id in team_1_players:
        team_1_players.remove(player_id)
        updates['team_1_players'] = team_1_players
    # Remove from team 2 if present
    elif player_id in team_2_players:
        team_2_players.remove(player_id)
        updates['team_2_players'] = team_2_players
    else:
        # Player not found in either team
        raise Exception(f"Player {player_id} not found in match {match_id}")
    
    # Check if we need to revert status to pending
    new_total = len(team_1_players) + len(team_2_players)
    if match.get('status') == 'confirmed' and new_total < 4:
        updates['status'] = 'pending'
        updates['confirmed_at'] = None
    
    # Update the player's invite status to 'removed'
    supabase.table("match_invites").update({
        "status": "removed",
        "responded_at": get_now_utc().isoformat()
    }).eq("match_id", match_id).eq("player_id", player_id).execute()
    
    # Send SMS notification to the removed player
    from twilio_client import send_sms
    try:
        # Get player phone number
        player_result = supabase.table("players").select("phone_number, name").eq("player_id", player_id).execute()
        if player_result.data:
            player = player_result.data[0]
            phone = player.get('phone_number')
            
            # Format match time for message
            try:
                dt = parse_iso_datetime(match['scheduled_time'])
                formatted_time = dt.strftime("%a, %b %d at %I:%M %p")
            except:
                formatted_time = match['scheduled_time']
            
            if phone:
                club_name = _get_club_name(match['club_id'])
                message = (
                    f"🎾 {club_name}: You've been removed from the match on {formatted_time}.\n\n"
                    f"If you have questions, please contact the organizer."
                )
                send_sms(phone, message, club_id=match['club_id'])
                print(f"Sent removal notification to {player.get('name')} ({phone})")
    except Exception as e:
        print(f"[WARNING] Failed to send removal SMS: {e}")
    
    return update_match(match_id, updates)
