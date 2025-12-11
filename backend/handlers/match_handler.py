import re
from datetime import datetime, timedelta
from database import supabase
from twilio_client import send_sms
from redis_client import clear_user_state, set_user_state
import sms_constants as msg
from handlers.date_parser import parse_natural_date


# Default match preferences
DEFAULT_LEVEL_RANGE = 0.25
DEFAULT_GENDER = "Mixed"


def handle_match_date_input(from_number: str, body: str, player: dict):
    """
    Handle date/time input for match request (first phase).
    Parses natural language input and asks for confirmation with preferences.
    """
    date_str = body.strip()
    
    # Check for Range (e.g., "2023-12-01 14:00-18:00") - keep existing voting flow
    if "-" in date_str and len(date_str.split("-")) >= 4:
        _handle_range_match(from_number, date_str, player)
        return
    
    # Try NLP parsing first
    parsed_dt, human_readable, iso_format = parse_natural_date(date_str)
    
    if parsed_dt is not None:
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    
    # Fallback: Try strict YYYY-MM-DD HH:MM format
    try:
        scheduled_time = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        human_readable = scheduled_time.strftime("%a, %b %d at %I:%M %p")
        iso_format = scheduled_time.isoformat()
        
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    except ValueError:
        pass
    
    # Neither worked - ask user to try again
    send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)


def _send_preferences_confirmation(from_number: str, human_readable: str, iso_format: str, player: dict):
    """
    Send confirmation message with match preferences.
    """
    player_level = player.get("declared_skill_level", 3.5) if player else 3.5
    
    # Calculate default level range
    level_min = max(2.0, player_level - DEFAULT_LEVEL_RANGE)
    level_max = min(5.5, player_level + DEFAULT_LEVEL_RANGE)
    
    # Format for display
    confirm_msg = msg.MSG_CONFIRM_DATE_WITH_PREFS.format(
        time=human_readable,
        level=player_level,
        range=DEFAULT_LEVEL_RANGE,
        gender=DEFAULT_GENDER
    )
    
    send_sms(from_number, confirm_msg)
    
    # Store in state for confirmation step
    set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
        "scheduled_time_iso": iso_format,
        "scheduled_time_human": human_readable,
        "level_min": level_min,
        "level_max": level_max,
        "gender_preference": "mixed"
    })


def handle_match_confirmation(from_number: str, body: str, player: dict, state_data: dict):
    """
    Handle confirmation of parsed date/time with preferences (second phase).
    Parses gender (M/F) and level range (e.g., 3.0-4.0).
    """
    response = body.strip()
    response_lower = response.lower()
    
    # Extract current state
    scheduled_time_iso = state_data.get("scheduled_time_iso")
    scheduled_time_human = state_data.get("scheduled_time_human")
    level_min = state_data.get("level_min", 3.0)
    level_max = state_data.get("level_max", 4.0)
    gender_preference = state_data.get("gender_preference", "mixed")
    
    if not scheduled_time_iso:
        send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)
        clear_user_state(from_number)
        return
    
    # Check for cancel
    if response_lower in ["no", "n", "cancel", "nope"]:
        send_sms(from_number, msg.MSG_DATE_CANCELLED)
        clear_user_state(from_number)
        return
    
    # Check for MUTE command during confirmation
    if response_lower == "mute":
        _handle_mute(from_number, player)
        clear_user_state(from_number)
        return
    
    # Parse modifications from the response
    new_gender = _parse_gender(response)
    new_level_range = _parse_level_range(response)
    
    # Update preferences if provided
    if new_gender:
        gender_preference = new_gender
    if new_level_range:
        level_min, level_max = new_level_range
    
    # Check if this is a confirmation (contains YES or is just M/F/level adjustment)
    is_confirmation = any(word in response_lower for word in ["yes", "y", "confirm", "ok", "yep", "yeah"])
    is_adjustment_only = (new_gender or new_level_range) and not is_confirmation
    
    if is_adjustment_only:
        # User adjusted preferences but didn't confirm - show updated confirmation
        player_level = player.get("declared_skill_level", 3.5) if player else 3.5
        range_display = (level_max - level_min) / 2
        gender_display = {"mixed": "Mixed", "male": "Male-only", "female": "Female-only"}.get(gender_preference, "Mixed")
        
        confirm_msg = msg.MSG_CONFIRM_DATE_WITH_PREFS.format(
            time=scheduled_time_human,
            level=player_level,
            range=range_display,
            gender=gender_display
        )
        
        send_sms(from_number, confirm_msg)
        set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
            "scheduled_time_iso": scheduled_time_iso,
            "scheduled_time_human": scheduled_time_human,
            "level_min": level_min,
            "level_max": level_max,
            "gender_preference": gender_preference
        })
        return
    
    if is_confirmation or (new_gender or new_level_range):
        # User confirmed - create the match with preferences
        _create_match(
            from_number, 
            scheduled_time_iso, 
            scheduled_time_human, 
            player,
            level_min,
            level_max,
            gender_preference
        )
        return
    
    # Try parsing as a new date/time
    parsed_dt, human_readable, iso_format = parse_natural_date(response)
    
    if parsed_dt is not None:
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    
    # Fallback: Try strict format
    try:
        scheduled_time = datetime.strptime(response, "%Y-%m-%d %H:%M")
        human_readable = scheduled_time.strftime("%a, %b %d at %I:%M %p")
        iso_format = scheduled_time.isoformat()
        
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    except ValueError:
        pass
    
    # Still not understood
    send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)


def _parse_gender(text: str) -> str | None:
    """
    Parse gender preference from response.
    Returns 'male', 'female', or None.
    """
    text_upper = text.upper()
    
    # Check for explicit M or F (not part of other words)
    if re.search(r'\bM\b', text_upper) or 'MALE' in text_upper and 'FEMALE' not in text_upper:
        return "male"
    if re.search(r'\bF\b', text_upper) or 'FEMALE' in text_upper:
        return "female"
    
    return None


def _parse_level_range(text: str) -> tuple | None:
    """
    Parse level range from response.
    Supports formats like "3.0-4.0" or "3.5 - 4.5".
    """
    # Pattern: number-number or number to number
    pattern = r'(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)'
    match = re.search(pattern, text.lower())
    
    if match:
        try:
            level_min = float(match.group(1))
            level_max = float(match.group(2))
            
            # Validate reasonable skill levels
            if 2.0 <= level_min <= 5.5 and 2.0 <= level_max <= 5.5 and level_min <= level_max:
                return (level_min, level_max)
        except ValueError:
            pass
    
    return None


def _handle_mute(from_number: str, player: dict):
    """
    Mute player from receiving invites until end of day.
    """
    if not player:
        return
    
    # Set muted_until to end of today (midnight)
    tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    supabase.table("players").update({
        "muted_until": tomorrow.isoformat()
    }).eq("player_id", player["player_id"]).execute()
    
    send_sms(from_number, msg.MSG_MUTED)


def _create_match(
    from_number: str, 
    scheduled_time_iso: str, 
    scheduled_time_human: str, 
    player: dict,
    level_min: float = None,
    level_max: float = None,
    gender_preference: str = "mixed"
):
    """
    Create match in database with preferences and trigger invites.
    """
    if not player:
        send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
        clear_user_state(from_number)
        return
    
    try:
        match_data = {
            "club_id": player["club_id"],
            "team_1_players": [player["player_id"]],
            "team_2_players": [],
            "scheduled_time": scheduled_time_iso,
            "status": "pending",
            "level_range_min": level_min,
            "level_range_max": level_max,
            "gender_preference": gender_preference,
        }
        
        supabase.table("matches").insert(match_data).execute()
        clear_user_state(from_number)
        
        # Trigger Matchmaker
        matches_res = supabase.table("matches").select("match_id").contains(
            "team_1_players", [player["player_id"]]
        ).order("created_at", desc=True).limit(1).execute()
        
        if matches_res.data:
            match_id = matches_res.data[0]["match_id"]
            from matchmaker import find_and_invite_players
            count = find_and_invite_players(match_id)
            send_sms(from_number, msg.MSG_MATCH_REQUESTED_CONFIRMED.format(
                time=scheduled_time_human, count=count
            ))
        else:
            send_sms(from_number, msg.MSG_MATCH_TRIGGER_FAIL)
            
    except Exception as e:
        print(f"Error creating match: {e}")
        send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)


def _handle_range_match(from_number: str, date_str: str, player: dict):
    """
    Handle time range format for voting matches (existing functionality).
    """
    try:
        parts = date_str.split(" ")
        if len(parts) < 2:
            send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)
            return

        date_part = parts[0]
        time_range = parts[1]
        if "-" not in time_range:
            send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)
            return
             
        start_time_str, end_time_str = time_range.split("-")
        
        start_dt = datetime.strptime(f"{date_part} {start_time_str}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{date_part} {end_time_str}", "%Y-%m-%d %H:%M")
        
        # Generate 120-min slots
        slots = []
        current_slot = start_dt
        while current_slot + timedelta(minutes=120) <= end_dt:
            slots.append(current_slot.isoformat())
            current_slot += timedelta(minutes=120)
        
        if not slots:
            send_sms(from_number, msg.MSG_RANGE_TOO_SHORT)
            return

        if not player:
            send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
            clear_user_state(from_number)
            return

        match_data = {
            "club_id": player["club_id"],
            "team_1_players": [player["player_id"]],
            "team_2_players": [],
            "scheduled_time": slots[0],
            "status": "voting",
            "voting_options": slots,
            "voting_deadline": (datetime.utcnow() + timedelta(hours=24)).isoformat()
        }
        
        supabase.table("matches").insert(match_data).execute()
        clear_user_state(from_number)
        
        # Trigger Matchmaker
        matches_res = supabase.table("matches").select("match_id").contains(
            "team_1_players", [player["player_id"]]
        ).order("created_at", desc=True).limit(1).execute()
        
        if matches_res.data:
            match_id = matches_res.data[0]["match_id"]
            
            # Auto-vote for all options for the requester
            for slot in slots:
                vote_data = {
                    "match_id": match_id,
                    "player_id": player["player_id"],
                    "selected_option": slot
                }
                supabase.table("match_votes").insert(vote_data).execute()

            from matchmaker import find_and_invite_players
            count = find_and_invite_players(match_id)
            send_sms(from_number, msg.MSG_MATCH_REQUESTED_VOTING.format(count=count))
        else:
            send_sms(from_number, msg.MSG_MATCH_TRIGGER_FAIL)

    except ValueError:
        send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)


# Backwards compatibility alias
def handle_match_request(from_number: str, body: str, player: dict):
    """
    Legacy function name for backwards compatibility.
    Routes to handle_match_date_input.
    """
    handle_match_date_input(from_number, body, player)
