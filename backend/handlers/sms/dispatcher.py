from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import re

# Core imports
from twilio_client import set_reply_from, set_club_name, set_dry_run, get_dry_run_responses, send_sms
from redis_client import get_user_state, set_user_state, clear_user_state
from logic.reasoner import reason_message, ReasonerResult
from error_logger import log_sms_error
import sms_constants as msg
from logic_utils import get_now_utc, parse_iso_datetime, format_sms_datetime

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

        from twilio_client import normalize_phone_number
        from_number = normalize_phone_number(from_number)
        to_number = normalize_phone_number(to_number)

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
            if current_state == "IDLE":
                current_state = None

            # 4. Fetch Pending Context (Invites)
            pending_context = None
            if player:
                # Include SENT, MAYBE, and RECENTLY DECLINED (within 3 hours) for context
                # This helps the AI understand if a response like "Sun" is a correction to a previous "No"
                three_hours_ago = (get_now_utc() - timedelta(hours=3)).isoformat()
                
                invites_res = supabase.table("match_invites") \
                    .select("match_id, status, responded_at, matches(scheduled_time, clubs(name, club_id))") \
                    .eq("player_id", player["player_id"]) \
                    .or_(f"status.in.(sent,maybe),and(status.eq.declined,responded_at.gt.{three_hours_ago})") \
                    .order("sent_at", desc=True) \
                    .execute()
                
                if invites_res.data:
                    pending_invites = []
                    for inv in invites_res.data:
                        match = inv.get("matches", {})
                        club = match.get("clubs", {})
                        
                        # CRITICAL: Localize the time for the AI to prevent "UTC Leak" hallucinations
                        raw_time = match.get("scheduled_time")
                        friendly_time = "Unknown"
                        if raw_time:
                            parsed_time = parse_iso_datetime(raw_time)
                            friendly_time = format_sms_datetime(parsed_time, club_id=club.get("club_id"))

                        pending_invites.append({
                            "type": "MATCH_INVITE",
                            "status": inv["status"],
                            "match_time_local": friendly_time, # Feed the AI the human-readable local time
                            "club_name": club.get("name")
                        })
                    pending_context = pending_invites

            # 5. Reasoner (AI Intent)
            reasoner_result = reason_message(body, current_state or "IDLE", player, history, golden_samples, pending_context=pending_context)
            intent = reasoner_result.intent
            confidence = reasoner_result.confidence
            entities = reasoner_result.entities
            raw_reasoning = reasoner_result.raw_reply
            
            print(f"[REASONER] Intent: {intent} (conf: {confidence}) | State: {current_state}")

            # 6. Inject Router-resolved Group into entities for downstream handlers
            if gid:
                entities = entities or {}
                if "group_id" not in entities:
                    entities["group_id"] = str(gid)

            # 5. Global Interrupts
            GLOBAL_INTERRUPTS = ["START_MATCH", "CHECK_STATUS", "RESET", "JOIN_GROUP", "MUTE", "UNMUTE", "REPORT_RESULT", "BOOK_COURT"]
            MATCH_STATES = [msg.STATE_MATCH_REQUEST_DATE, msg.STATE_MATCH_REQUEST_CONFIRM, msg.STATE_MATCH_GROUP_SELECTION]
            
            # Explicit commands always interrupt
            cmd = body.lower().strip()
            is_explicit_match_cmd = cmd == "play" or cmd == "reset"
            
            is_match_interruption = (intent in ["START_MATCH", "JOIN_GROUP"] and current_state in MATCH_STATES)

            if (intent in GLOBAL_INTERRUPTS and confidence > 0.8 and not is_match_interruption) or is_explicit_match_cmd:
                print(f"[SMS] Global interrupt: '{intent}' overriding state '{current_state}'")
                clear_user_state(from_number)
                current_state = None 

            # 6. Dispatch Logic
            
            # A. Command Processing (No State)
            if player and player.get("is_member") and not current_state:
                # 1. Fetch actionable invites (SENT/MAYBE)
                all_invites_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).in_("status", ["sent", "maybe"]).order("sent_at", desc=True).execute()
                all_sent_invites = all_invites_res.data or []
                
                # A. FAST PATH: Literal numbered responses (e.g. "1Y", "1")
                numbered_match = re.match(r'^(\d+)([ynm])?$', cmd)
                if numbered_match and all_sent_invites:
                    invite_index = int(numbered_match.group(1)) - 1
                    action_char = numbered_match.group(2)
                    action = {'y': 'yes', 'n': 'no', 'm': 'maybe'}.get(action_char, 'yes')
                    
                    if 0 <= invite_index < len(all_sent_invites):
                        handle_invite_response(from_number, action, player, all_sent_invites[invite_index])
                        return 
                    else:
                        send_sms(from_number, "❌ Invalid match number.", club_id=cid)
                        return

                # B. SLOW PATH: Reasoner-detected intents (e.g. "Yes!", "Count me in!")
                if intent == "ACCEPT_INVITE" and confidence > 0.8:
                    if all_sent_invites:
                        handle_invite_response(from_number, "yes", player, all_sent_invites[0])
                        return
                    else:
                        # Falling through to AI reply is often fine here if they say "Yes" but have no invites
                        pass
                elif intent == "DECLINE_INVITE" and confidence > 0.8:
                    if all_sent_invites:
                        handle_invite_response(from_number, "no", player, all_sent_invites[0])
                        return
                elif intent == "DECLINE_WITH_ALTERNATIVE" and confidence > 0.8:
                    # HEURISTIC: If declining with alternative, we can also apply this to a RECENTLY declined invite
                    # This handles the case where someone says "No Saturday" then corrected to "Wait, Sunday"
                    target_invite = all_sent_invites[0] if all_sent_invites else None
                    if not target_invite:
                        # Try to find the most recent invite regardless of status
                        recent_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).order("sent_at", desc=True).limit(1).execute()
                        target_invite = recent_res.data[0] if recent_res.data else None
                    
                    if target_invite:
                        handle_invite_response(from_number, "no", player, target_invite, entities=entities)
                        return

                # Normal Commands
                if cmd == "reset":
                    pass # Done, cleared above
                elif cmd == "play" or (intent == "START_MATCH" and confidence > 0.8):
                    handle_play_command(from_number, body, player, cid, entities)
                    return
                elif intent == "REPORT_RESULT" and confidence > 0.8:
                    handle_result_report(from_number, player, entities, cid=cid)
                    return
                elif intent == "BOOK_COURT" and confidence > 0.8:
                    handle_court_booking_sms(from_number, player, entities, cid=cid)
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
                    handle_groups_command(from_number, player, cid, cname, ai_reply=reasoner_result.reply_text)
                    return
                elif cmd == "availability":
                    handle_availability_command(from_number, player, cid) 
                    return
                
                # Fallback / ChitChat
                if intent in ["GREETING", "CHITCHAT"] and reasoner_result.reply_text:
                    send_sms(from_number, reasoner_result.reply_text, club_id=cid)
                    return
                
                # Default
                reply = reasoner_result.reply_text or msg.MSG_WELCOME_BACK.format(club_name=cname, name=player['name'])
                send_sms(from_number, reply, club_id=cid)
                return

            # B. Check Onboarding / New Member
            if not current_state:
                if not cid:
                    print(f"[DISPATCHER] Unknown club context for number {to_number}. Likely environment mismatch.")
                    return

                if player and player.get("is_member"): return
                
                # UNIVERSAL PLAYER: If they already exist in the system, just add them to this club
                if player:
                    print(f"[DISPATCHER] Player {from_number} exists, adding to club {cid}")
                    try:
                        supabase.table("club_members").insert({
                            "club_id": cid,
                            "player_id": player["player_id"]
                        }).execute()
                        
                        welcome_back = msg.MSG_PROFILE_UPDATE_DONE.format(club_name=cname)
                        send_sms(from_number, welcome_back, club_id=cid)
                        return
                    except Exception as e:
                        print(f"[DISPATCHER] Error adding existing player to club: {e}")
                
                # Truly new player - start onboarding
                send_sms(from_number, msg.MSG_WELCOME_NEW.format(club_name=cname, booking_system=booking_sys), club_id=cid)
                set_user_state(from_number, msg.STATE_WAITING_NAME, {"club_id": cid, "club_name": cname})
                return

            # C. State Handlers
            if current_state in [msg.STATE_WAITING_NAME, msg.STATE_WAITING_LEVEL, msg.STATE_WAITING_GENDER, msg.STATE_WAITING_AVAILABILITY, msg.STATE_WAITING_GROUPS_ONBOARDING]:
                handle_onboarding(from_number, body, current_state, state_data, cid)
                return
            
            elif current_state == msg.STATE_UPDATING_AVAILABILITY:
                from .commands import handle_availability_update
                handle_availability_update(from_number, body, player, cid)
                return

            elif current_state == msg.STATE_BROWSING_GROUPS:
                from .commands import handle_group_browsing_response
                handle_group_browsing_response(from_number, body, player, state_data, entities, cid)
                return

            elif current_state == msg.STATE_MATCH_REQUEST_DATE:
                handle_match_request(from_number, body, player, entities, cid=cid)
                return
            elif current_state == msg.STATE_MATCH_REQUEST_CONFIRM:
                handle_match_confirmation(from_number, body, player, state_data, entities, cid=cid)
                return
            elif current_state == msg.STATE_MATCH_GROUP_SELECTION:
                handle_group_selection(from_number, body, player, state_data, entities, cid=cid)
                return
            elif current_state == msg.STATE_DEADPOOL_REFILL:
                from handlers.match_handler import handle_deadpool_response
                handle_deadpool_response(from_number, body, player, state_data, cid)
                return
            elif current_state == msg.STATE_WAITING_FEEDBACK:
                handle_feedback_response(from_number, body, player, state_data, cid=cid)
                return

        except Exception as e:
            error_cid = cid if 'cid' in locals() else club_id
            
            log_sms_error(
                error_message=f"System error in dispatcher: {e}",
                phone_number=from_number,
                sms_body=body,
                exception=e
            )
            
            if error_cid:
                send_sms(from_number, "System error in dispatcher.", club_id=error_cid)
            else:
                print("[DISPATCHER] Could not send error SMS: No club context available.")
        
        finally:
            if dry_run:
                return {
                    "responses": get_dry_run_responses(),
                    "intent": intent,
                    "confidence": confidence,
                    "entities": entities,
                    "raw_reasoning": raw_reasoning
                }
