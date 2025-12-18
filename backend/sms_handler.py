from twilio_client import send_sms, set_reply_from, set_club_name, get_club_name
from redis_client import get_user_state, set_user_state, clear_user_state
from database import supabase
import sms_constants as msg
from handlers.invite_handler import handle_invite_response
from handlers.match_handler import (
    handle_match_confirmation, 
    handle_match_date_input,
    handle_match_request,
    handle_group_selection 
)
from handlers.onboarding_handler import handle_onboarding
from handlers.feedback_handler import handle_feedback_response
from error_logger import log_sms_error
from datetime import datetime
import re
from logic.reasoner import reason_message, ReasonerResult

def handle_incoming_sms(from_number: str, body: str, to_number: str = None):
    """
    Handle incoming SMS messages.
    
    Args:
        from_number: The sender's phone number
        body: The message content
        to_number: The Twilio number that received the SMS (determines which club)
    """
    # Set the reply-from number in context so all send_sms calls use the correct club number
    if to_number:
        set_reply_from(to_number)
    
    # 0. Look up which club this Twilio number belongs to
    club_id = None
    club_name = "the club"  # Default fallback
    if to_number:
        club_res = supabase.table("clubs").select("club_id, name").eq("phone_number", to_number).execute()
        if club_res.data:
            club_id = club_res.data[0]["club_id"]
            club_name = club_res.data[0]["name"]
        else:
            # Unknown Twilio number - try first club as fallback
            fallback = supabase.table("clubs").select("club_id, name").limit(1).execute()
            if fallback.data:
                club_id = fallback.data[0]["club_id"]
                club_name = fallback.data[0].get("name", "the club")
                print(f"[WARNING] Unknown Twilio number {to_number}, using fallback club")
            else:
                send_sms(from_number, "Sorry, this number is not configured for any club.")
                return
    else:
        # No to_number provided (e.g., old test code) - use first club
        fallback = supabase.table("clubs").select("club_id, name").limit(1).execute()
        if fallback.data:
            club_id = fallback.data[0]["club_id"]
            club_name = fallback.data[0].get("name", "the club")

    # Set club name in context so all handlers can access it
    set_club_name(club_name)

    # 1. Check if user exists in DB for THIS CLUB
    # Note: A player can be registered at multiple clubs with the same phone number
    player = None
    if club_id:
        response = supabase.table("players").select("*").eq("phone_number", from_number).eq("club_id", club_id).execute()
        player = response.data[0] if response.data else None

    # 2. Get current conversation state from Redis
    state_data = get_user_state(from_number)
    current_state = state_data.get("state") if state_data else None

    # 3. REASONING GATEWAY (New Intelligence Layer)
    # Determine intent using Gemini (or fast-path keywords)
    reasoner_result = reason_message(body, current_state or "IDLE", player)
    intent = reasoner_result.intent
    confidence = reasoner_result.confidence
    # If the reasoner is very confident in a new intent, we might interrupt the flow.
    
    print(f"[REASONER] Intent: {intent} (conf: {confidence}) | State: {current_state}")

    # 4. Check for Global Interrupts (High confidence intents that override everything)
    # Allows "PLAY", "MATCHES", "RESET" to break out of any state
    GLOBAL_INTERRUPTS = ["START_MATCH", "CHECK_STATUS", "RESET", "JOIN_GROUP", "MUTE", "UNMUTE"]
    
    # Map intents to legacy command strings for compatibility
    if intent in GLOBAL_INTERRUPTS and confidence > 0.8:
        print(f"[SMS] Global interrupt: '{intent}' overriding state '{current_state}'")
        clear_user_state(from_number)
        current_state = None # Reset state so command logic below catches it
        
        # Map intents to legacy command strings for compatibility
        if intent == "START_MATCH":
            body = "play" # Force command
        elif intent == "CHECK_STATUS":
            body = "matches"
        elif intent == "RESET":
            body = "reset"
        elif intent == "JOIN_GROUP":
            body = "groups"
        elif intent == "MUTE":
            body = "mute"
        elif intent == "UNMUTE":
            body = "unmute"

    # 5. COMMAND PROCESSING (For IDLE state or Global Interrupts)
    if player and not current_state:
        cmd = body.lower().strip()
        
        # Check for Invite Responses
        # Patterns: YES, NO, MAYBE, 1, 1Y, 1N, 2Y, 2N, A, B, AB (voting)
        # Get ALL active invites for this player
        all_invites_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).in_("status", ["sent", "maybe"]).order("sent_at", desc=True).execute()
        all_sent_invites = all_invites_res.data if all_invites_res.data else []
        
        if all_sent_invites:
            # Parse numbered responses: 1, 1Y, 1N, 2, 2Y, 2N, etc.
            numbered_match = re.match(r'^(\d+)([ynm])?$', cmd)
            
            invite_index = None  # 0-based index
            action = None  # 'yes', 'no', 'maybe'
            
            if numbered_match:
                invite_index = int(numbered_match.group(1)) - 1
                action_char = numbered_match.group(2)
                if action_char == 'y':
                    action = 'yes'
                elif action_char == 'n':
                    action = 'no'
                elif action_char == 'm':
                    action = 'maybe'
                else:
                    action = 'yes'
            elif cmd == "yes":
                invite_index = 0
                action = 'yes'
            elif cmd == "no":
                invite_index = 0
                action = 'no'
            elif cmd.startswith("maybe"):
                invite_index = 0
                action = 'maybe'
            elif len(cmd) < 5 and all(c.isalpha() for c in cmd):
                known_commands = {"play", "help", "next", "mute", "stop", "no", "yes"}
                if cmd not in known_commands:
                    invite_index = 0
                    action = cmd
            
            if invite_index is not None:
                if invite_index < 0 or invite_index >= len(all_sent_invites):
                    send_sms(from_number, f"❌ Invalid match number. You have {len(all_sent_invites)} pending invite(s). Reply 1-{len(all_sent_invites)}.")
                    return
                
                selected_invite = all_sent_invites[invite_index]
                handle_invite_response(from_number, action, player, selected_invite)
                return


        if cmd == "reset":
             # Debugging tool to restart flow
             pass
        elif cmd == "play":
            print(f"[DEBUG] PLAY command received from {from_number}. Club: {club_name}")
            try:
                msg_content = msg.MSG_REQUEST_DATE.format(club_name=club_name)
                print(f"[DEBUG] Sending PLAY response: {msg_content}")
                send_sms(from_number, msg_content)
                set_user_state(from_number, msg.STATE_MATCH_REQUEST_DATE)
            except Exception as e:
                print(f"[ERROR] Failed to process PLAY command: {e}")
                import traceback
                traceback.print_exc()
                send_sms(from_number, f"debug_error: {str(e)}")
            return
        elif cmd == "mute":
            # Mute player for rest of day
            from datetime import timedelta
            tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            muted_until = player.get("muted_until")
            
            if muted_until:
                try:
                    muted_dt = datetime.fromisoformat(muted_until.replace('Z', '+00:00')).replace(tzinfo=None)
                    if muted_dt > datetime.now():
                        send_sms(from_number, msg.MSG_ALREADY_MUTED)
                        return
                except:
                    pass
            
            supabase.table("players").update({
                "muted_until": tomorrow.isoformat()
            }).eq("player_id", player["player_id"]).execute()
            send_sms(from_number, msg.MSG_MUTED)
            return
        elif cmd == "unmute":
            # Clear mute
            muted_until = player.get("muted_until")
            if not muted_until:
                send_sms(from_number, msg.MSG_NOT_MUTED)
                return
            
            try:
                muted_dt = datetime.fromisoformat(muted_until.replace('Z', '+00:00')).replace(tzinfo=None)
                if muted_dt <= datetime.now():
                    send_sms(from_number, msg.MSG_NOT_MUTED)
                    return
            except:
                pass
            
            supabase.table("players").update({
                "muted_until": None
            }).eq("player_id", player["player_id"]).execute()
            send_sms(from_number, msg.MSG_UNMUTED)
            return
        elif cmd in ["help", "?"]:
            # Twilio handles this via Messaging Service (Opt-Out management)
            # We silently return 200 OK to avoid sending a duplicate message
            print(f"[DEBUG] HELP command received from {from_number}. Letting Twilio handle response.")
            return
            
        elif cmd in ["commands", "menu"]:
            help_text = (
                f"🎾 {club_name.upper()} COMMANDS\n\n"
                "MATCH RESPONSES:\n"
                "• YES - Accept invite\n"
                "• NO - Decline invite\n"
                "• MAYBE - Tentative\n\n"
                "MATCH INFO:\n"
                "• MATCHES - View your matches\n"
                "• NEXT - Next confirmed match\n\n"
                "OTHER:\n"
                "• PLAY - Request a match\n"
                "• GROUPS - Join player groups\n"
                "• AVAILABILITY - Set play times\n"
                "• MUTE - Pause invites for today\n"
                "• UNMUTE - Resume invites\n"
                "• COMMANDS - Show this message"
            )
            send_sms(from_number, help_text)
            return
        elif cmd == "matches":
            try:
                # Show player's matches - includes both matches they requested AND matches they were invited to
                player_id = player["player_id"]
                print(f"[DEBUG] MATCHES for player {player_id} ({from_number})")
                
                # Get current time for filtering past matches
                now = datetime.utcnow()
                
                def is_future_match(match):
                    """Check if match scheduled_time is in the future."""
                    try:
                        scheduled = datetime.fromisoformat(match['scheduled_time'].replace('Z', '+00:00'))
                        scheduled = scheduled.replace(tzinfo=None)
                        return scheduled > now
                    except:
                        return True
                
                # 1. Get matches where player is already in teams (as requester or confirmed)
                # Query matches where player is in team_1_players OR team_2_players
                matches_as_player = supabase.table("matches").select("*").or_(
                    f"team_1_players.cs.{{\"{player_id}\"}},team_2_players.cs.{{\"{player_id}\"}}"
                ).execute().data or []
                
                # 2. Get matches where player has invites (pending/maybe invites)
                all_invites = supabase.table("match_invites").select("match_id, status").eq("player_id", player_id).in_("status", ["sent", "maybe"]).order("sent_at", desc=True).execute().data or []
                invite_match_ids = [i["match_id"] for i in all_invites]
                
                # Get match data for invites
                matches_from_invites = []
                if invite_match_ids:
                    matches_from_invites = supabase.table("matches").select("*").in_("match_id", invite_match_ids).execute().data or []
                
                # Combine and dedupe matches
                all_matches_by_id = {}
                for m in matches_as_player:
                    all_matches_by_id[m["match_id"]] = m
                for m in matches_from_invites:
                    all_matches_by_id[m["match_id"]] = m
                
                # Categorize matches
                confirmed = []
                pending_as_requester = []  # Matches player requested, still pending
                pending_invites = []  # Matches player was invited to (from invites)
                
                for m in all_matches_by_id.values():
                    if not is_future_match(m):
                        continue
                    
                    all_players = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                    
                    if m["status"] == "confirmed" and player_id in all_players:
                        confirmed.append(m)
                    elif m["status"] == "pending":
                        # Player is the requester (in team already) vs invited
                        if player_id in all_players:
                            pending_as_requester.append(m)
                        elif m["match_id"] in invite_match_ids:
                            pending_invites.append(m)
                
                print(f"[DEBUG] Confirmed: {len(confirmed)}, Pending (requester): {len(pending_as_requester)}, Pending (invites): {len(pending_invites)}")
                
                if not confirmed and not pending_as_requester and not pending_invites:
                    send_sms(from_number, f"🎾 {club_name}: You have no match invites. Text PLAY to request a match!")
                    return
                
                response = f"🎾 {club_name}: Your matches:\n\n"
                
                # Show confirmed matches
                if confirmed:
                    response += "✅ CONFIRMED:\n"
                    for m in confirmed:
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        response += f"• {time_str}\n"
                        
                        # Add player names
                        all_pids = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        for pid in all_pids:
                            p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                            if p_res.data:
                                p = p_res.data[0]
                                response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                        response += "\n"
                
                # Show pending matches where player is requester
                if pending_as_requester:
                    response += "⏳ YOUR PENDING REQUESTS:\n"
                    for m in pending_as_requester:
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        all_pids = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        count = len(all_pids)
                        response += f"• {time_str} ({count}/4 confirmed)\n"
                        
                        # Show who's in
                        for pid in all_pids:
                            p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                            if p_res.data:
                                p = p_res.data[0]
                                response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                        response += "\n"
                
                # Show pending invites (from others)
                if pending_invites:
                    response += "📩 PENDING INVITES (reply with #):\n"
                    for i, m in enumerate(pending_invites, 1):
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        all_pids = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        count = len(all_pids)
                        response += f"{i}. {time_str} ({count}/4)\n"
                        
                        for pid in all_pids:
                            p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                            if p_res.data:
                                p = p_res.data[0]
                                response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                        response += "\n"
                    response += "Reply 1Y to join, 1N to decline, etc."
                
                send_sms(from_number, response)
            except Exception as e:
                print(f"[ERROR] MATCHES command failed: {e}")
                import traceback
                traceback.print_exc()
                send_sms(from_number, "Sorry, something went wrong. Please try again.")
            return
        elif cmd == "next":
            # Show next confirmed match
            player_id = player["player_id"]
            invites = supabase.table("match_invites").select("match_id").eq("player_id", player_id).eq("status", "accepted").execute().data
            
            if not invites:
                send_sms(from_number, f"🎾 {club_name}: No confirmed matches yet. Reply MATCHES to see pending invites!")
                return
            
            match_ids = [i["match_id"] for i in invites]
            matches = supabase.table("matches").select("*").in_("match_id", match_ids).eq("status", "confirmed").order("scheduled_time").limit(1).execute().data
            
            if not matches:
                send_sms(from_number, f"🎾 {club_name}: No confirmed matches yet. Reply MATCHES to see pending invites!")
                return
            
            m = matches[0]
            try:
                dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                time_str = dt.strftime("%A, %b %d at %I:%M %p")
            except:
                time_str = m['scheduled_time']
            
            # Get player names
            all_ids = m.get("team_1_players", []) + m.get("team_2_players", [])
            names = []
            for pid in all_ids:
                p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                if p_res.data:
                    p = p_res.data[0]
                    names.append(f"  - {p['name']} ({p['declared_skill_level']})")
            
            players_text = "\n".join(names)
            
            response = (
                f"🎾 {club_name}: Your next match:\n\n"
                f"📅 {time_str}\n\n"
                f"👥 Players:\n{players_text}\n\n"
                f"See you on the court! 🏸"
            )
            send_sms(from_number, response)
            return
        elif cmd == "status":
            send_sms(from_number, "📊 Reply MATCHES to see your match invites with details.")
            return
        elif cmd == "groups":
            # List public groups
            try:
                public_groups = supabase.table("player_groups").select("group_id, name").eq("club_id", club_id).eq("visibility", "public").execute().data or []
                if not public_groups:
                    send_sms(from_number, msg.MSG_NO_PUBLIC_GROUPS.format(club_name=club_name))
                    return
                
                groups_text = "\n".join([f"{i+1}. {g['name']}" for i, g in enumerate(public_groups)])
                send_sms(from_number, msg.MSG_GROUPS_LIST_AVAILABLE.format(club_name=club_name, groups_list=groups_text))
                set_user_state(from_number, msg.STATE_BROWSING_GROUPS, {"available_groups": public_groups, "club_id": str(club_id)})
            except Exception as e:
                print(f"[ERROR] GROUPS command failed: {e}")
                send_sms(from_number, "Sorry, I couldn't fetch groups right now.")
            return
        elif cmd == "availability":
            send_sms(from_number, msg.MSG_ASK_AVAILABILITY_UPDATE)
            set_user_state(from_number, msg.STATE_UPDATING_AVAILABILITY)
            return
        else:
            send_sms(from_number, msg.MSG_WELCOME_BACK.format(club_name=club_name, name=player['name']))
            return

    # If no state and no player, start onboarding
    if not current_state:
        if player:
             return
        
        # Start onboarding - store club_id in state for later
        send_sms(from_number, msg.MSG_WELCOME_NEW.format(club_name=club_name))
        set_user_state(from_number, msg.STATE_WAITING_NAME, {"club_id": club_id, "club_name": club_name})
        return

    # Handle States
    if current_state in [msg.STATE_WAITING_NAME, msg.STATE_WAITING_LEVEL, msg.STATE_WAITING_GENDER, msg.STATE_WAITING_AVAILABILITY, msg.STATE_WAITING_GROUPS_ONBOARDING]:
        handle_onboarding(from_number, body, current_state, state_data, club_id)

    elif current_state == msg.STATE_UPDATING_AVAILABILITY:
        body_upper = body.upper().strip()
        
        # Default all to False - or should we modify existing?
        # Let's overwrite with new selection for simplicity
        avail_updates = {
            "avail_weekday_morning": False,
            "avail_weekday_afternoon": False,
            "avail_weekday_evening": False,
            "avail_weekend_morning": False,
            "avail_weekend_afternoon": False,
            "avail_weekend_evening": False
        }
        
        if "G" in body_upper or "ANYTIME" in body_upper:
             for key in avail_updates:
                 avail_updates[key] = True
        else:
            mapping = {
                "A": "avail_weekday_morning",
                "B": "avail_weekday_afternoon",
                "C": "avail_weekday_evening",
                "D": "avail_weekend_morning",
                "E": "avail_weekend_afternoon",
                "F": "avail_weekend_evening"
            }
            for letter, key in mapping.items():
                if letter in body_upper:
                    avail_updates[key] = True
        
        try:
            supabase.table("players").update(avail_updates).eq("player_id", player["player_id"]).execute()
            
            # Construct confirmation message
            active = [k for k, v in avail_updates.items() if v]
            if len(active) == 6:
                confirm = "Anytime"
            elif not active:
                confirm = "None"
            else:
                # E.g. "Weekday mornings, Weekend evenings"
                readable = {
                    "avail_weekday_morning": "Weekday mornings",
                    "avail_weekday_afternoon": "Weekday afternoons",
                    "avail_weekday_evening": "Weekday evenings",
                    "avail_weekend_morning": "Weekend mornings",
                    "avail_weekend_afternoon": "Weekend afternoons",
                    "avail_weekend_evening": "Weekend evenings"
                }
                parts = [readable[k] for k in active]
                confirm = ", ".join(parts)
            
            send_sms(from_number, "Got it! Availability updated: {confirm}")
            clear_user_state(from_number)
        except Exception as e:
            print(f"[ERROR] Failed to update availability: {e}")
            send_sms(from_number, "Sorry, something went wrong updating your availability.")
            clear_user_state(from_number)

    elif current_state == msg.STATE_BROWSING_GROUPS:
        # Handle group selection to join
        # Use entities from Reasoner if available (e.g. "selection": 1)
        selection = reasoner_result.entities.get("selection")
        
        nums = []
        if selection:
            nums = [str(selection)]
        else:
             # Fallback to regex
             import re
             nums = re.findall(r'\d+', body)
        
        if not nums:
            # If they didn't send a number, maybe they are done
            # BUT: Check if it was a greeting or unknown before just quitting
            if intent in ["GREETING", "CHITCHAT", "UNKNOWN"]:
                 send_sms(from_number, msg.MSG_NUDGE_GROUP_SELECTION)
                 return
            
            clear_user_state(from_number)
            send_sms(from_number, "No groups joined. Text GROUPS anytime to browse again.")
            return
        
        available = state_data.get("available_groups", [])
        joined_names = []
        joined_ids = []
        for n in nums:
             idx = int(n) - 1
             if 0 <= idx < len(available):
                  joined_names.append(available[idx]["name"])
                  joined_ids.append(available[idx]["group_id"])
        
        if joined_ids:
            try:
                # Add player to selected groups
                player_id = player["player_id"]
                memberships = [{"group_id": gid, "player_id": player_id} for gid in joined_ids]
                # Upsert would be better if we had it, but let's just insert one by one or filter
                # Simple approach: filter out already joined
                existing = supabase.table("group_memberships").select("group_id").eq("player_id", player_id).in_("group_id", joined_ids).execute().data or []
                existing_ids = {row["group_id"] for row in existing}
                
                final_to_join = [m for m in memberships if m["group_id"] not in existing_ids]
                final_names = [available[i]["name"] for i, m in enumerate(memberships) if m["group_id"] not in existing_ids]

                if final_to_join:
                    supabase.table("group_memberships").insert(final_to_join).execute()
                    send_sms(from_number, msg.MSG_JOINED_GROUPS_SUCCESS.format(group_names=", ".join(final_names)))
                else:
                    send_sms(from_number, "You are already a member of those groups!")
                
                clear_user_state(from_number)
            except Exception as e:
                print(f"[ERROR] Failed to join groups: {e}")
                send_sms(from_number, "Sorry, something went wrong joining those groups.")
                clear_user_state(from_number)
        else:
            send_sms(from_number, "Invalid selection. Please reply with a number from the list or text RESET.")

    # --- Match Request Flow ---
    elif current_state == msg.STATE_MATCH_REQUEST_DATE:
        try:
            handle_match_request(from_number, body, player)
        except Exception as e:
            print(f"[ERROR] handle_match_request failed: {e}")
            log_sms_error(f"Match request handler failed: {e}", from_number, body, e)
            send_sms(from_number, "Sorry, something went wrong processing your request. Please try again.")
            clear_user_state(from_number)
    
    elif current_state == msg.STATE_MATCH_REQUEST_CONFIRM:
        try:
            handle_match_confirmation(from_number, body, player, state_data)
        except Exception as e:
            print(f"[ERROR] handle_match_confirmation failed: {e}")
            log_sms_error(f"Match confirmation handler failed: {e}", from_number, body, e)
            send_sms(from_number, "Sorry, something went wrong confirming your match. Please text PLAY to try again.")
            clear_user_state(from_number)
        
    elif current_state == msg.STATE_MATCH_GROUP_SELECTION:
        handle_group_selection(from_number, body, player, state_data)

    # --- Feedback Collection Flow ---
    elif current_state == msg.STATE_WAITING_FEEDBACK:
        try:
            handle_feedback_response(from_number, body, player, state_data)
        except Exception as e:
            print(f"[ERROR] handle_feedback_response failed: {e}")
            log_sms_error(f"Feedback handler failed: {e}", from_number, body, e)
            clear_user_state(from_number)

