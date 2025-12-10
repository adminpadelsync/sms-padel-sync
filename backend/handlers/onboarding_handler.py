from database import supabase
from twilio_client import send_sms
from redis_client import set_user_state, clear_user_state
import sms_constants as msg

def handle_onboarding(from_number: str, body: str, current_state: str, state_data: dict, club_id: str = None):
    """
    Handle the onboarding flow for new users.
    args:
        from_number: User's phone number
        body: Message body
        current_state: Current state name
        state_data: Current state data dictionary
        club_id: The club ID to associate this player with (from Twilio number lookup)
    """
    # Get club_id from state_data if not passed directly (may have been stored earlier)
    if not club_id and state_data:
        club_id = state_data.get("club_id")
    
    # Handle States
    if current_state == msg.STATE_WAITING_NAME:
        name = body.strip()
        if len(name) < 2:
            send_sms(from_number, msg.MSG_NAME_TOO_SHORT)
            return
        
        # Preserve club_id in state for next step
        set_user_state(from_number, msg.STATE_WAITING_LEVEL, {"name": name, "club_id": club_id})
        send_sms(from_number, msg.MSG_ASK_LEVEL.format(name=name))

    elif current_state == msg.STATE_WAITING_LEVEL:
        level_map = {
            "a": 2.5, "2.5": 2.5,
            "b": 3.0, "3.0": 3.0,
            "c": 3.5, "3.5": 3.5,
            "d": 4.0, "4.0": 4.0,
            "e": 4.5, "4.5": 4.5,
            "f": 5.0, "5.0": 5.0
        }
        choice = body.lower().strip()
        level = level_map.get(choice)
        
        if not level:
            send_sms(from_number, msg.MSG_INVALID_LEVEL)
            return

        # Preserve club_id in state for next step
        set_user_state(from_number, msg.STATE_WAITING_AVAILABILITY, {"level": str(level), "club_id": club_id})
        send_sms(from_number, msg.MSG_ASK_AVAILABILITY)

    elif current_state == msg.STATE_WAITING_AVAILABILITY:
        availability = body.strip()
        
        # Save to DB
        name = state_data.get("name")
        level = float(state_data.get("level"))
        
        # Use the club_id passed through the flow
        if not club_id:
            # Fallback to first club if somehow not set
            club_res = supabase.table("clubs").select("club_id").limit(1).execute()
            if not club_res.data:
                send_sms(from_number, msg.MSG_SYSTEM_ERROR)
                return
            club_id = club_res.data[0]["club_id"]

        new_player = {
            "phone_number": from_number,
            "name": name,
            "declared_skill_level": level,
            "adjusted_skill_level": level,
            "availability_preferences": {"text": availability},
            "club_id": club_id,
            "active_status": True
        }

        try:
            supabase.table("players").insert(new_player).execute()
            clear_user_state(from_number)
            send_sms(from_number, msg.MSG_PROFILE_SETUP_DONE)
        except Exception as e:
            print(f"Error creating player: {e}")
            send_sms(from_number, msg.MSG_PROFILE_ERROR)

