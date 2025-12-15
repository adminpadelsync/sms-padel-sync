from database import supabase
from twilio_client import send_sms, get_club_name
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

        # Preserve name and club_id in state for next step
        set_user_state(from_number, msg.STATE_WAITING_GENDER, {"name": state_data.get("name"), "level": str(level), "club_id": club_id})
        send_sms(from_number, msg.MSG_ASK_GENDER)

    elif current_state == msg.STATE_WAITING_GENDER:
        gender_map = {
            "m": "male",
            "male": "male",
            "f": "female",
            "female": "female"
        }
        choice = body.lower().strip()
        gender = gender_map.get(choice)
        
        if not gender:
            send_sms(from_number, msg.MSG_INVALID_GENDER)
            return

        # Preserve all data in state for next step
        set_user_state(from_number, msg.STATE_WAITING_AVAILABILITY, {
            "name": state_data.get("name"),
            "level": state_data.get("level"),
            "gender": gender,
            "club_id": club_id
        })
        send_sms(from_number, msg.MSG_ASK_AVAILABILITY_ONBOARDING)

    elif current_state == msg.STATE_WAITING_AVAILABILITY:
        body_upper = body.upper().strip()
        
        # Default all to False
        avail_updates = {
            "avail_weekday_morning": False,
            "avail_weekday_afternoon": False,
            "avail_weekday_evening": False,
            "avail_weekend_morning": False,
            "avail_weekend_afternoon": False,
            "avail_weekend_evening": False
        }
        
        # Parse choices
        # Check for "G" or "ANYTIME" -> set all to True
        if "G" in body_upper or "ANYTIME" in body_upper:
             for key in avail_updates:
                 avail_updates[key] = True
        else:
            # Map letters to keys
            mapping = {
                "A": "avail_weekday_morning",
                "B": "avail_weekday_afternoon",
                "C": "avail_weekday_evening",
                "D": "avail_weekend_morning",
                "E": "avail_weekend_afternoon",
                "F": "avail_weekend_evening"
            }
            
            # Check for each letter
            for letter, key in mapping.items():
                if letter in body_upper:
                    avail_updates[key] = True
        
        # Save to DB
        name = state_data.get("name")
        level = float(state_data.get("level"))
        gender = state_data.get("gender")
        
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
            "gender": gender,
            "declared_skill_level": level,
            "adjusted_skill_level": level,
            "club_id": club_id,
            "active_status": True,
            **avail_updates
        }

        try:
            supabase.table("players").insert(new_player).execute()
            clear_user_state(from_number)
            send_sms(from_number, msg.MSG_PROFILE_SETUP_DONE.format(club_name=get_club_name()))
        except Exception as e:
            print(f"Error creating player: {e}")
            send_sms(from_number, msg.MSG_PROFILE_ERROR)

