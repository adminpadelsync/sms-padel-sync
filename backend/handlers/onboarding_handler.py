from database import supabase
from twilio_client import send_sms, get_club_name
from redis_client import set_user_state, clear_user_state
import sms_constants as msg

def handle_onboarding(from_number: str, body: str, current_state: str, state_data: dict, club_id: str = None):
    """
    Handle the onboarding flow for new users.
    """
    try:
        # Get club_id from state_data if not passed directly (may have been stored earlier)
        if not club_id and state_data:
            club_id = state_data.get("club_id")
        
        if not club_id:
            print(f"[ONBOARDING ERROR] No club_id found for {from_number} in state {current_state}")
            return

        print(f"[ONBOARDING] {from_number} in state {current_state} sent: '{body}' (club_id: {club_id})")
        
        # Handle States
        if current_state == msg.STATE_WAITING_NAME:
            name = body.strip()
            if len(name) < 2:
                send_sms(from_number, msg.MSG_NAME_TOO_SHORT, club_id=club_id)
                return
            
            set_user_state(from_number, msg.STATE_WAITING_LEVEL, {"name": name, "club_id": club_id})
            send_sms(from_number, msg.MSG_ASK_LEVEL.format(name=name), club_id=club_id)

        elif current_state == msg.STATE_WAITING_LEVEL:
            level_map = {
                "a": 2.5, "2.5": 2.5, "b": 3.0, "3.0": 3.0, "c": 3.5, "3.5": 3.5,
                "d": 4.0, "4.0": 4.0, "e": 4.5, "4.5": 4.5, "f": 5.0, "5.0": 5.0
            }
            choice = body.lower().strip()
            level = level_map.get(choice)
            
            if not level:
                send_sms(from_number, msg.MSG_INVALID_LEVEL, club_id=club_id)
                return

            set_user_state(from_number, msg.STATE_WAITING_GENDER, {
                "name": state_data.get("name"), 
                "level": str(level), 
                "club_id": club_id
            })
            send_sms(from_number, msg.MSG_ASK_GENDER, club_id=club_id)

        elif current_state == msg.STATE_WAITING_GENDER:
            gender_map = {"m": "male", "male": "male", "f": "female", "female": "female"}
            choice = body.lower().strip()
            gender = gender_map.get(choice)
            
            if not gender:
                send_sms(from_number, msg.MSG_INVALID_GENDER, club_id=club_id)
                return

            # Check for public groups
            try:
                public_groups_res = supabase.table("player_groups").select("group_id, name").eq("club_id", club_id).eq("visibility", "public").execute()
                public_groups = public_groups_res.data or []
            except Exception as e:
                print(f"Error fetching public groups: {e}")
                public_groups = []

            if public_groups:
                set_user_state(from_number, msg.STATE_WAITING_GROUPS_ONBOARDING, {
                    "name": state_data.get("name"),
                    "level": state_data.get("level"),
                    "gender": gender,
                    "club_id": club_id,
                    "available_groups": public_groups
                })
                groups_text = "\n".join([f"{i+1}. {g['name']}" for i, g in enumerate(public_groups)])
                send_sms(from_number, msg.MSG_ASK_GROUPS_ONBOARDING.format(groups_list=groups_text), club_id=club_id)
            else:
                set_user_state(from_number, msg.STATE_WAITING_AVAILABILITY, {
                    "name": state_data.get("name"),
                    "level": state_data.get("level"),
                    "gender": gender,
                    "club_id": club_id
                })
                send_sms(from_number, msg.MSG_ASK_AVAILABILITY_ONBOARDING, club_id=club_id)

        elif current_state == msg.STATE_WAITING_GROUPS_ONBOARDING:
            import re
            choice = body.strip().upper()
            selected_ids = []
            
            if choice != "SKIP":
                nums = re.findall(r'\d+', choice)
                available = state_data.get("available_groups", [])
                for n in nums:
                    try:
                        idx = int(n) - 1
                        if 0 <= idx < len(available):
                            selected_ids.append(available[idx]["group_id"])
                    except:
                        continue
            
            set_user_state(from_number, msg.STATE_WAITING_AVAILABILITY, {
                "name": state_data.get("name"),
                "level": state_data.get("level"),
                "gender": state_data.get("gender"),
                "club_id": club_id,
                "selected_group_ids": selected_ids
            })
            send_sms(from_number, msg.MSG_ASK_AVAILABILITY_ONBOARDING, club_id=club_id)

        elif current_state == msg.STATE_WAITING_AVAILABILITY:
            # ... availability logic ...
            body_upper = body.upper().strip()
            name = state_data.get("name")
            gender = state_data.get("gender")
            level = float(state_data.get("level")) if state_data.get("level") else 0.0
            
            avail_updates = {
                "avail_weekday_morning": False, "avail_weekday_afternoon": False, "avail_weekday_evening": False,
                "avail_weekend_morning": False, "avail_weekend_afternoon": False, "avail_weekend_evening": False
            }
            
            if "G" in body_upper or "ANYTIME" in body_upper:
                 for key in avail_updates: avail_updates[key] = True
            else:
                mapping = {
                    "A": "avail_weekday_morning", "B": "avail_weekday_afternoon", "C": "avail_weekday_evening",
                    "D": "avail_weekend_morning", "E": "avail_weekend_afternoon", "F": "avail_weekend_evening"
                }
                for letter, key in mapping.items():
                    if letter in body_upper: avail_updates[key] = True
            
            try:
                # Universal Player already added to club in dispatcher, but here we update profile
                import re
                digits = re.sub(r'\D', '', from_number)
                last_10 = digits[-10:] if len(digits) >= 10 else digits
                
                existing_res = supabase.table("players").select("player_id") \
                    .or_(f"phone_number.eq.{from_number},phone_number.ilike.%{last_10}") \
                    .execute()
                
                if existing_res.data:
                    player_id = existing_res.data[0]["player_id"]
                    supabase.table("players").update({
                        "name": name, "gender": gender, "declared_skill_level": level, "adjusted_skill_level": level, **avail_updates
                    }).eq("player_id", player_id).execute()
                    
                    # Ensure added to club if not already
                    member_res = supabase.table("club_members").select("*").eq("club_id", club_id).eq("player_id", player_id).execute()
                    if not member_res.data:
                        supabase.table("club_members").insert({"club_id": club_id, "player_id": player_id}).execute()
                    
                    # Add to groups
                    selected_group_ids = state_data.get("selected_group_ids", [])
                    if selected_group_ids:
                        existing_groups_res = supabase.table("group_memberships").select("group_id").eq("player_id", player_id).in_("group_id", selected_group_ids).execute()
                        existing_gids = {row["group_id"] for row in (existing_groups_res.data or [])}
                        new_memberships = [{"group_id": gid, "player_id": player_id} for gid in selected_group_ids if gid not in existing_gids]
                        if new_memberships:
                            supabase.table("group_memberships").insert(new_memberships).execute()
                    
                    clear_user_state(from_number)
                    from twilio_client import get_club_name
                    send_sms(from_number, msg.MSG_PROFILE_UPDATE_DONE.format(club_name=get_club_name()), club_id=club_id)
                    return

                # NEW PLAYER Creation
                from logic.elo_service import get_initial_elo
                initial_elo = get_initial_elo(level)
                new_player_data = {
                    "phone_number": from_number, "name": name, "gender": gender,
                    "declared_skill_level": level, "adjusted_skill_level": level,
                    "elo_rating": initial_elo, "active_status": True, **avail_updates
                }
                
                player_res = supabase.table("players").insert(new_player_data).execute()
                if player_res.data:
                    new_player_id = player_res.data[0]["player_id"]
                    supabase.table("club_members").insert({"club_id": club_id, "player_id": new_player_id}).execute()
                    supabase.table("player_rating_history").insert({
                        "player_id": new_player_id, "new_elo_rating": initial_elo, "new_sync_rating": level, "change_type": "onboarding"
                    }).execute()

                    selected_group_ids = state_data.get("selected_group_ids", [])
                    if selected_group_ids:
                        memberships = [{"group_id": gid, "player_id": new_player_id} for gid in selected_group_ids]
                        supabase.table("group_memberships").insert(memberships).execute()
                
                clear_user_state(from_number)
                from twilio_client import get_club_name
                send_sms(from_number, msg.MSG_PROFILE_SETUP_DONE.format(club_name=get_club_name()), club_id=club_id)
            except Exception as db_err:
                print(f"[ONBOARDING ERROR] DB Update failed: {db_err}")
                send_sms(from_number, msg.MSG_PROFILE_ERROR, club_id=club_id)

    except Exception as e:
        print(f"[ONBOARDING CRITICAL ERROR] {e}")
        if club_id:
            send_sms(from_number, msg.MSG_PROFILE_ERROR, club_id=club_id)


