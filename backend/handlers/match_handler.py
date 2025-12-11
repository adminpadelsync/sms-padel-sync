from datetime import datetime, timedelta
from database import supabase
from twilio_client import send_sms
from redis_client import clear_user_state, set_user_state
import sms_constants as msg
from handlers.date_parser import parse_natural_date


def handle_match_date_input(from_number: str, body: str, player: dict):
    """
    Handle date/time input for match request (first phase).
    Parses natural language input and asks for confirmation.
    """
    date_str = body.strip()
    
    # Check for Range (e.g., "2023-12-01 14:00-18:00") - keep existing voting flow
    if "-" in date_str and len(date_str.split("-")) >= 4:
        _handle_range_match(from_number, date_str, player)
        return
    
    # Try NLP parsing first
    parsed_dt, human_readable, iso_format = parse_natural_date(date_str)
    
    if parsed_dt is not None:
        # Successfully parsed - ask for confirmation
        send_sms(from_number, msg.MSG_CONFIRM_DATE.format(time=human_readable))
        # Store parsed time in state for confirmation step
        set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
            "scheduled_time_iso": iso_format,
            "scheduled_time_human": human_readable
        })
        return
    
    # Fallback: Try strict YYYY-MM-DD HH:MM format
    try:
        scheduled_time = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        human_readable = scheduled_time.strftime("%a, %b %d at %I:%M %p")
        iso_format = scheduled_time.isoformat()
        
        # Ask for confirmation
        send_sms(from_number, msg.MSG_CONFIRM_DATE.format(time=human_readable))
        set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
            "scheduled_time_iso": iso_format,
            "scheduled_time_human": human_readable
        })
        return
    except ValueError:
        pass
    
    # Neither worked - ask user to try again
    send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)


def handle_match_confirmation(from_number: str, body: str, player: dict, state_data: dict):
    """
    Handle confirmation of parsed date/time (second phase).
    Creates the match if user confirms.
    """
    response = body.strip().lower()
    
    if response in ["yes", "y", "confirm", "ok", "yep", "yeah"]:
        # User confirmed - create the match
        scheduled_time_iso = state_data.get("scheduled_time_iso")
        scheduled_time_human = state_data.get("scheduled_time_human")
        
        if not scheduled_time_iso:
            send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)
            clear_user_state(from_number)
            return
        
        _create_match(from_number, scheduled_time_iso, scheduled_time_human, player)
        return
    
    elif response in ["no", "n", "cancel", "nope"]:
        # User cancelled
        send_sms(from_number, msg.MSG_DATE_CANCELLED)
        clear_user_state(from_number)
        return
    
    else:
        # User entered new date/time - try parsing it
        parsed_dt, human_readable, iso_format = parse_natural_date(response)
        
        if parsed_dt is not None:
            # Successfully parsed - ask for confirmation again
            send_sms(from_number, msg.MSG_CONFIRM_DATE.format(time=human_readable))
            set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
                "scheduled_time_iso": iso_format,
                "scheduled_time_human": human_readable
            })
            return
        
        # Fallback: Try strict format
        try:
            scheduled_time = datetime.strptime(body.strip(), "%Y-%m-%d %H:%M")
            human_readable = scheduled_time.strftime("%a, %b %d at %I:%M %p")
            iso_format = scheduled_time.isoformat()
            
            send_sms(from_number, msg.MSG_CONFIRM_DATE.format(time=human_readable))
            set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
                "scheduled_time_iso": iso_format,
                "scheduled_time_human": human_readable
            })
            return
        except ValueError:
            pass
        
        # Still not understood
        send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)


def _create_match(from_number: str, scheduled_time_iso: str, scheduled_time_human: str, player: dict):
    """
    Actually create the match in database and trigger invites.
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
