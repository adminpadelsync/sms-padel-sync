from datetime import datetime, timedelta
from database import supabase
from twilio_client import send_sms
from redis_client import clear_user_state
import sms_constants as msg

def handle_match_request(from_number: str, body: str, player: dict):
    """
    Handle a match request (date/time entry).
    """
    date_str = body.strip()
    
    # Check for Range (e.g., "2023-12-01 14:00-18:00")
    if "-" in date_str and len(date_str.split("-")) >= 4: # Crude check for YYYY-MM-DD HH:MM-HH:MM
        try:
            # Split into Date + Time Range
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
                current_slot += timedelta(minutes=120) # Non-overlapping slots for MVP
            
            if not slots:
                send_sms(from_number, msg.MSG_RANGE_TOO_SHORT)
                return

            # Create Voting Match
            if not player:
                send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
                clear_user_state(from_number)
                return

            match_data = {
                "club_id": player["club_id"],
                "team_1_players": [player["player_id"]],
                "team_2_players": [],
                "scheduled_time": slots[0], # Default to first slot for schema compliance, but status is voting
                "status": "voting",
                "voting_options": slots,
                "voting_deadline": (datetime.utcnow() + timedelta(hours=24)).isoformat()
            }
            
            supabase.table("matches").insert(match_data).execute()
            clear_user_state(from_number)
            
            # Trigger Matchmaker
            matches_res = supabase.table("matches").select("match_id").contains("team_1_players", [player["player_id"]]).order("created_at", desc=True).limit(1).execute()
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
            return

        except ValueError:
            send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)
            return

    # Single Time Logic (Existing)
    try:
        # Simple parsing for MVP: YYYY-MM-DD HH:MM
        # In production, use dateparser for "Tomorrow 6pm"
        scheduled_time = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        
        # Default Duration: 120 minutes
        # duration = 120
        scheduled_time_iso = scheduled_time.isoformat()
        
        # Create Match
        try:
            # We need player_id and club_id
            # We already fetched player at the top
            if not player:
                send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
                clear_user_state(from_number)
                return

            match_data = {
                "club_id": player["club_id"],
                "team_1_players": [player["player_id"]], # Requester is in Team 1
                "team_2_players": [], # Empty for now
                "scheduled_time": scheduled_time_iso,
                "status": "pending",
                # We could store duration in settings or a new column, but for now we just create the match
            }
            
            supabase.table("matches").insert(match_data).execute()
            clear_user_state(from_number)
            
            # Trigger Matchmaker (Synchronous for MVP, should be async job)
            # We need to get the match_id we just created. 
            # Ideally we'd return it from insert, but let's fetch the latest pending match for this user
            matches_res = supabase.table("matches").select("match_id").contains("team_1_players", [player["player_id"]]).order("created_at", desc=True).limit(1).execute()
            if matches_res.data:
                match_id = matches_res.data[0]["match_id"]
                from matchmaker import find_and_invite_players
                count = find_and_invite_players(match_id)
                send_sms(from_number, msg.MSG_MATCH_REQUESTED_CONFIRMED.format(time=scheduled_time_iso, count=count))
            else:
                send_sms(from_number, msg.MSG_MATCH_TRIGGER_FAIL)

        except Exception as e:
            print(f"Error creating match: {e}")
            send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)
            
    except ValueError:
        send_sms(from_number, msg.MSG_INVALID_DATE_FORMAT)
        return
