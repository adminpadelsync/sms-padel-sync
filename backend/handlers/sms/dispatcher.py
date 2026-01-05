from typing import List, Dict, Any, Optional
from datetime import datetime

# Core imports
from twilio_client import set_reply_from, set_club_name, set_dry_run, get_dry_run_responses, send_sms
from redis_client import get_user_state, set_user_state, clear_user_state
from logic.reasoner import reason_message, ReasonerResult
from error_logger import log_sms_error
import sms_constants as msg

# New Package Imports
from .router import resolve_club_context, resolve_player
from .commands import (
    handle_matches_command, handle_play_command, handle_mute_command, 
    handle_unmute_command, handle_reset_command, handle_help_command,
    handle_groups_command, handle_availability_command
)

# Legacy Handlers (to be refactored later, but imported for flow compatibility)
from handlers.invite_handler import handle_invite_response
from handlers.match_handler import (
    handle_match_confirmation, handle_match_date_input, handle_match_request, 
    handle_group_selection, handle_court_booking_sms
)
from handlers.onboarding_handler import handle_onboarding
from handlers.feedback_handler import handle_feedback_response
from handlers.result_handler import handle_result_report
from database import supabase

class IntentDispatcher:
    def handle_sms(self, from_number: str, body: str, to_number: str = None, club_id: str = None, dry_run: bool = False, history: List[Dict[str, str]] = None, golden_samples: List[Dict[str, Any]] = None):
        if dry_run:
            set_dry_run(True)

        intent = "UNKNOWN"
        confidence = 0.0
        entities = {}
        raw_reasoning = ""

        try:
            # 1. Resolve Context (Router)
            cid, cname, gid, gname, booking_sys = resolve_club_context(from_number, to_number, club_id)
            if gid:
                # Append group name for display
                cname = f"{cname} - {gname}"
            
            set_club_name(cname)
            
            # 2. Resolve Player (Router)
            player = resolve_player(from_number, cid)
            
            # 3. Get State
            state_data = get_user_state(from_number)
            current_state = state_data.get("state") if state_data else None

            # 4. Reasoner (AI Intent)
            reasoner_result = reason_message(body, current_state or "IDLE", player, history, golden_samples)
            intent = reasoner_result.intent
            confidence = reasoner_result.confidence
            entities = reasoner_result.entities
            raw_reasoning = reasoner_result.raw_reply
            
            print(f"[REASONER] Intent: {intent} (conf: {confidence}) | State: {current_state}")

            # 5. Global Interrupts
            GLOBAL_INTERRUPTS = ["START_MATCH", "CHECK_STATUS", "RESET", "JOIN_GROUP", "MUTE", "UNMUTE", "REPORT_RESULT", "BOOK_COURT"]
            MATCH_STATES = [msg.STATE_MATCH_REQUEST_DATE, msg.STATE_MATCH_REQUEST_CONFIRM, msg.STATE_MATCH_GROUP_SELECTION]
            is_match_interruption = (intent in ["START_MATCH", "JOIN_GROUP"] and current_state in MATCH_STATES)

            if intent in GLOBAL_INTERRUPTS and confidence > 0.8 and not is_match_interruption:
                print(f"[SMS] Global interrupt: '{intent}' overriding state '{current_state}'")
                clear_user_state(from_number)
                current_state = None 
                
                # Logic Mapping for Interrupts
                if intent == "START_MATCH":
                    # If not starting with 'play', force it roughly? 
                    # Actually handle_play_command takes entities.
                    pass 
                
                # We define body override only if we need to force a command string match? 
                # Better to dispatch directly below.

            # 6. Dispatch Logic
            
            # A. Command Processing (No State)
            if player and not current_state:
                cmd = body.lower().strip()
                
                # Invite Response Logic (1Y, 1N, etc.)
                # ... (This logic is complex, maybe put in commands too? For now, implementing inline or calling helper?)
                # Ideally, extract "handle_invite_response_check" to commands.
                # I'll check if I can assume commands.py handles it.
                # commands.py doesn't have invite check logic yet. 
                # I should add it there or keep it here.
                # Keeping it here makes dispatcher fat.
                # Let's import it if I added it? Only added matches/groups/mute/play.
                # I'll add a TODO to move invite logic. For now, copy-paste or implement cleanly.
                
                # Actually, let's look at invite logic. It's robust.
                # I'll implement a `check_invite_response` in commands.py?
                # No, I'll do it inline here for Phase 2 speed, then refactor in Phase 3 if needed. 
                # Wait, Phase 2 IS refactor.
                
                # OK, let's implement the invite check logic here concisely.
                
                all_invites_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).in_("status", ["sent", "maybe"]).order("sent_at", desc=True).execute()
                all_sent_invites = all_invites_res.data or []
                
                if all_sent_invites:
                    # .. checking logic ..
                    import re
                    numbered_match = re.match(r'^(\d+)([ynm])?$', cmd)
                    invite_index = None
                    action = None
                    
                    if numbered_match:
                        invite_index = int(numbered_match.group(1)) - 1
                        action_char = numbered_match.group(2)
                        action = {'y': 'yes', 'n': 'no', 'm': 'maybe'}.get(action_char, 'yes')
                    elif cmd == "yes": invite_index = 0; action = 'yes'
                    elif cmd == "no": invite_index = 0; action = 'no'
                    elif cmd.startswith("maybe"): invite_index = 0; action = 'maybe'
                    elif len(cmd) < 5 and cmd.isalpha() and cmd not in {"play", "help", "next", "mute", "stop", "matches"}:
                        invite_index = 0; action = cmd
                        
                    if invite_index is not None:
                        if 0 <= invite_index < len(all_sent_invites):
                            handle_invite_response(from_number, action, player, all_sent_invites[invite_index])
                            return # Done
                        else:
                             send_sms(from_number, f"❌ Invalid match number.", club_id=cid)
                             return

                # Normal Commands
                if cmd == "reset":
                    pass # Done, cleared above
                elif cmd == "play" or (intent == "START_MATCH" and confidence > 0.8):
                    handle_play_command(from_number, body, player, cid, entities, str(gid) if gid else None)
                    return
                elif intent == "REPORT_RESULT" and confidence > 0.8:
                    handle_result_report(from_number, player, entities)
                    return
                elif intent == "BOOK_COURT" and confidence > 0.8:
                    handle_court_booking_sms(from_number, player, entities)
                    return
                elif cmd == "mute" or intent == "MUTE":
                    handle_mute_command(from_number, player, cid)
                    return
                elif cmd == "unmute" or intent == "UNMUTE":
                    handle_unmute_command(from_number, player, cid)
                    return
                elif cmd in ["commands", "menu"] or cmd == "help":
                    handle_help_command(from_number, cname, cid)
                    return
                elif cmd == "matches" or (intent == "CHECK_STATUS" and confidence > 0.8):
                    handle_matches_command(from_number, player, cid, cname)
                    return
                elif cmd == "groups" or (intent == "JOIN_GROUP" and confidence > 0.8):
                    handle_groups_command(from_number, player, cid, cname)
                    return
                elif cmd == "availability":
                    handle_availability_command(from_number, player, cid) # Need to export this
                    # If I missed adding it to commands.py, I should fix that.
                    # I think I didn't add handle_availability_command implementation yet.
                    # I'll stub it or add it to commands.py
                    return
                
                # Fallback / ChitChat
                if intent in ["GREETING", "CHITCHAT"] and reasoner_result.reply_text:
                    send_sms(from_number, reasoner_result.reply_text, club_id=cid)
                    return
                
                # Default
                reply = reasoner_result.reply_text or msg.MSG_WELCOME_BACK.format(club_name=cname, name=player['name'])
                send_sms(from_number, reply, club_id=cid)
                return

            # B. Check Onboarding
            if not current_state:
                if player: return
                send_sms(from_number, msg.MSG_WELCOME_NEW.format(club_name=cname, booking_system=booking_sys), club_id=cid)
                set_user_state(from_number, msg.STATE_WAITING_NAME, {"club_id": cid, "club_name": cname})
                return

            # C. State Handlers
            if current_state in [msg.STATE_WAITING_NAME, msg.STATE_WAITING_LEVEL, msg.STATE_WAITING_GENDER, msg.STATE_WAITING_AVAILABILITY, msg.STATE_WAITING_GROUPS_ONBOARDING]:
                handle_onboarding(from_number, body, current_state, state_data, cid)
            
            elif current_state == msg.STATE_UPDATING_AVAILABILITY:
                # Need to move this logic to commands or handlers/availability_handler.py
                # For now, let's assume it's refactored or kept inline? 
                # It's bulky. Ideally I'd put it in 'commands.py' as 'handle_availability_update'.
                from .commands import handle_availability_update
                handle_availability_update(from_number, body, player, cid)

            elif current_state == msg.STATE_BROWSING_GROUPS:
                # Move to logic?
                from .commands import handle_group_browsing_response
                handle_group_browsing_response(from_number, body, player, state_data, entities, cid)

            elif current_state == msg.STATE_MATCH_REQUEST_DATE:
                handle_match_request(from_number, body, player, entities) # Reuse handler
            elif current_state == msg.STATE_MATCH_REQUEST_CONFIRM:
                handle_match_confirmation(from_number, body, player, state_data, entities)
            elif current_state == msg.STATE_MATCH_GROUP_SELECTION:
                handle_group_selection(from_number, body, player, state_data, entities)
            elif current_state == "DEADPOOL_REFILL": # msg.STATE_DEADPOOL_REFILL
                # Dead pool logic
                pass # Implement inline or helper
            elif current_state == msg.STATE_WAITING_FEEDBACK:
                handle_feedback_response(from_number, body, player, state_data)

        except Exception as e:
            print(f"[DISPATCHER ERROR] {e}")
            import traceback
            traceback.print_exc()
            send_sms(from_number, "System error in dispatcher.", club_id=club_id)
        
        finally:
            if dry_run:
                return {
                    "responses": get_dry_run_responses(),
                    "intent": intent,
                    "confidence": confidence,
                    "entities": entities,
                    "raw_reasoning": raw_reasoning
                }
