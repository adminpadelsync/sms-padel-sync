from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import re
import pytz

from database import supabase
from twilio_client import send_sms
import sms_constants as msg
from redis_client import set_user_state, clear_user_state
from logic_utils import (
    get_club_timezone, 
    parse_iso_datetime, 
    format_sms_datetime,
    get_now_utc
)
from handlers.match_handler import handle_match_request
from handlers.result_handler import handle_result_report
from handlers.match_handler import handle_court_booking_sms
from error_logger import log_error

def handle_matches_command(from_number: str, player: Dict, club_id: str, club_name: str):
    """Show player's matches - includes both matches they requested AND matches they were invited to"""
    try:
        player_id = player["player_id"]
        print(f"[DEBUG] MATCHES for player {player_id} ({from_number})")
        
        # Get current time for filtering past matches
        try:
            tz_str = get_club_timezone(club_id)
            tz = pytz.timezone(tz_str)
        except Exception:
            tz = pytz.timezone("America/New_York")
        
        # Store aware now, but we compare naive-to-naive for safety with DB strings
        now_utc = get_now_utc()
        now_local = now_utc.astimezone(tz).replace(tzinfo=None)
        
        def is_future_match(match):
            """Check if match scheduled_time is in the future."""
            try:
                scheduled = parse_iso_datetime(match['scheduled_time'])
                if scheduled.tzinfo:
                    return scheduled > datetime.now(tz)
                else:
                    return scheduled > now_local
            except Exception as e:
                print(f"Error checking future match: {e}")
                return True
        
        # 1. Get matches where player is already in teams
        matches_as_player = supabase.table("matches").select("*").or_(
            f"team_1_players.cs.{{\"{player_id}\"}},team_2_players.cs.{{\"{player_id}\"}}"
        ).execute().data or []
        
        # 2. Get matches where player has invites
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
        pending_as_requester = []
        pending_invites = []
        
        for m in all_matches_by_id.values():
            if not is_future_match(m):
                continue
            
            # Phase 4 Update: Use match_participations source of truth
            from logic_utils import get_match_participants
            parts = get_match_participants(m["match_id"])
            all_players = parts["all"]
            
            if m["status"] == "confirmed" and player_id in all_players:
                confirmed.append(m)
            elif m["status"] == "pending":
                if player_id in all_players:
                    pending_as_requester.append(m)
                elif m["match_id"] in invite_match_ids:
                    pending_invites.append(m)
        
        if not confirmed and not pending_as_requester and not pending_invites:
            send_sms(from_number, f"🎾 {club_name}: You have no existing match invites, but I'm happy to set up a game for you. Just let me know when you'd like to play.", club_id=club_id)
            return
        
        response = f"🎾 {club_name}: Your matches:\n\n"
        
        # Show confirmed matches
        if confirmed:
            response += "✅ CONFIRMED:\n"
            for m in confirmed:
                try:
                    time_str = format_sms_datetime(parse_iso_datetime(m['scheduled_time']), club_id=club_id)
                except:
                    time_str = m['scheduled_time']
                response += f"• {time_str}\n"
                
                parts = get_match_participants(m["match_id"])
                all_pids = parts["all"]
                for pid in all_pids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                response += "\n"
        
        # Show pending matches (requester)
        if pending_as_requester:
            response += "⏳ YOUR PENDING REQUESTS:\n"
            for m in pending_as_requester:
                try:
                    time_str = format_sms_datetime(parse_iso_datetime(m['scheduled_time']), club_id=club_id)
                except:
                    time_str = m['scheduled_time']
                parts = get_match_participants(m["match_id"])
                all_pids = parts["all"]
                count = len(all_pids)
                response += f"• {time_str} ({count}/4 confirmed)\n"
                
                for pid in all_pids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                response += "\n"
        
        # Show pending invites
        if pending_invites:
            response += "📩 PENDING INVITES (reply with #):\n"
            for i, m in enumerate(pending_invites, 1):
                try:
                    time_str = format_sms_datetime(parse_iso_datetime(m['scheduled_time']), club_id=club_id)
                except:
                    time_str = m['scheduled_time']
                parts = get_match_participants(m["match_id"])
                all_pids = parts["all"]
                count = len(all_pids)
                response += f"{i}. {time_str} ({count}/4)\n"
                
                for pid in all_pids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                response += "\n"
            response += "Reply 1Y to join, 1N to decline, etc."
        
        send_sms(from_number, response, club_id=club_id)

    except Exception as e:
        log_error(
            error_type="sms_command",
            error_message=f"MATCHES command failed: {e}",
            phone_number=from_number,
            player_id=player_id,
            club_id=club_id,
            handler_name="handle_matches_command",
            exception=e
        )
        send_sms(from_number, "Sorry, something went wrong. Please try again.", club_id=club_id)


def handle_groups_command(from_number: str, player: Dict, club_id: str, club_name: str):
    """List public groups with membership status"""
    try:
        # 1. Get all public groups for this club
        public_groups = supabase.table("player_groups").select("group_id, name").eq("club_id", club_id).eq("visibility", "public").execute().data or []
        if not public_groups:
            send_sms(from_number, msg.MSG_NO_PUBLIC_GROUPS.format(club_name=club_name), club_id=club_id)
            return
        
        # 2. Get current player memberships FOR THIS CLUB
        memberships = supabase.table("group_memberships").select(
            "group_id, player_groups!inner(club_id)"
        ).eq("player_id", player["player_id"]).eq("player_groups.club_id", club_id).execute().data or []
        member_group_ids = {m["group_id"] for m in memberships}
        
        # 3. Categorize and sort groups
        member_groups = [g for g in public_groups if g["group_id"] in member_group_ids]
        available_groups = [g for g in public_groups if g["group_id"] not in member_group_ids]
        
        all_groups_ordered = member_groups + available_groups
        
        # 4. Construct message
        response = f"🎾 {club_name} Public Groups:\n"
        
        count = 1
        if member_groups:
            response += "\nGroups you are a member of:\n"
            for g in member_groups:
                response += f"{count}. {g['name']}\n"
                count += 1
        
        if available_groups:
            response += "\nGroups available to join:\n"
            for g in available_groups:
                response += f"{count}. {g['name']}\n"
                count += 1
        
        response += "\nReply with a number to join/leave a group."
        
        send_sms(from_number, response, club_id=club_id)
        set_user_state(from_number, msg.STATE_BROWSING_GROUPS, {
            "available_groups": all_groups_ordered, 
            "member_group_ids": list(member_group_ids),
            "club_id": str(club_id)
        })
    except Exception as e:
        log_error(
            error_type="sms_command",
            error_message=f"GROUPS command failed: {e}",
            phone_number=from_number,
            player_id=player.get("player_id"),
            club_id=club_id,
            handler_name="handle_groups_command",
            exception=e
        )
        send_sms(from_number, "Sorry, I couldn't fetch groups right now.", club_id=club_id)


def handle_mute_command(from_number: str, player: Dict, club_id: str):
    """Mute player for rest of day"""
    now = get_now_utc()
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    muted_until = player.get("muted_until")
    
    if muted_until:
        try:
            muted_dt = parse_iso_datetime(muted_until).replace(tzinfo=None)
            if muted_dt > get_now_utc().replace(tzinfo=None):
                send_sms(from_number, msg.MSG_ALREADY_MUTED, club_id=club_id)
                return
        except:
            pass
    
    supabase.table("players").update({
        "muted_until": tomorrow.isoformat()
    }).eq("player_id", player["player_id"]).execute()
    send_sms(from_number, msg.MSG_MUTED, club_id=club_id)


def handle_unmute_command(from_number: str, player: Dict, club_id: str):
    """Clear mute"""
    muted_until = player.get("muted_until")
    if not muted_until:
        send_sms(from_number, msg.MSG_NOT_MUTED, club_id=club_id)
        return
    
    try:
        muted_dt = parse_iso_datetime(muted_until).replace(tzinfo=None)
        if muted_dt <= get_now_utc().replace(tzinfo=None):
            send_sms(from_number, msg.MSG_NOT_MUTED, club_id=club_id)
            return
    except:
        pass
    
    supabase.table("players").update({
        "muted_until": None
    }).eq("player_id", player["player_id"]).execute()
    send_sms(from_number, msg.MSG_UNMUTED, club_id=club_id)


def handle_play_command(from_number: str, body: str, player: Dict, club_id: str, entities: Dict = None, group_id: str = None):
    """Wraps handle_match_request"""
    try:
        entities = entities or {}
        if group_id:
            entities["group_id"] = str(group_id)
        handle_match_request(from_number, body, player, entities, cid=club_id)
    except Exception as e:
        print(f"[ERROR] Failed to process PLAY command: {e}")
        import traceback
        traceback.print_exc()
        send_sms(from_number, f"debug_error: {str(e)}", club_id=club_id)

def handle_help_command(from_number: str, club_name: str, club_id: str):
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
    send_sms(from_number, help_text, club_id=club_id)

def handle_reset_command(from_number: str, club_id: str):
    """Handle reset command - mostly just logging as state is cleared by dispatcher"""
    print(f"[SMS] RESET command received from {from_number}")


def handle_availability_command(from_number: str, player: Dict, club_id: str):
    """Initiate availability update flow"""
    send_sms(from_number, msg.MSG_ASK_AVAILABILITY_UPDATE, club_id=club_id)
    set_user_state(from_number, msg.STATE_UPDATING_AVAILABILITY)

def handle_availability_update(from_number: str, body: str, player: Dict, club_id: str):
    """Process availability update response"""
    body_upper = body.upper().strip()
    
    # Default all to False - overwrite with new selection
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
        
        send_sms(from_number, f"Got it! Availability updated: {confirm}", club_id=club_id)
        clear_user_state(from_number)
    except Exception as e:
        log_error(
            error_type="sms_command",
            error_message=f"Failed to update availability: {e}",
            phone_number=from_number,
            player_id=player.get("player_id"),
            club_id=club_id,
            handler_name="handle_availability_update",
            exception=e
        )
        send_sms(from_number, "Sorry, something went wrong updating your availability.", club_id=club_id)
        clear_user_state(from_number)

def handle_group_browsing_response(from_number: str, body: str, player: Dict, state_data: Dict, entities: Dict, club_id: str):
    """Handle group selection to join or leave"""
    selection = entities.get("selection") if entities else None
    
    nums = []
    if selection:
        nums = [str(selection)]
    else:
            nums = re.findall(r'\d+', body)
    
    if not nums:
        # Check intents? The dispatcher might check generic intent first, but here we just check failure.
        # If no numbers found, and we are in this state, maybe trigger a nudge or exit.
        # Original logic checked for GREETING/CHITCHAT. 
        # Here we just nudge or exit.
        clear_user_state(from_number)
        send_sms(from_number, "No changes made. Text GROUPS anytime to browse again.", club_id=club_id)
        return
    
    all_groups = state_data.get("available_groups", [])
    member_group_ids = set(state_data.get("member_group_ids", []))
    player_id = player["player_id"]
    
    to_join = []
    to_leave = []
    join_names = []
    leave_names = []
    
    for n in nums:
        try:
            idx = int(n) - 1
            if 0 <= idx < len(all_groups):
                group = all_groups[idx]
                if group["group_id"] in member_group_ids:
                    to_leave.append(group["group_id"])
                    leave_names.append(group["name"])
                else:
                    to_join.append(group["group_id"])
                    join_names.append(group["name"])
        except ValueError:
            continue
    
    if to_join or to_leave:
        try:
            responses = []
            
            if to_join:
                memberships = [{"group_id": gid, "player_id": player_id} for gid in to_join]
                supabase.table("group_memberships").insert(memberships).execute()
                responses.append(f"Joined: {', '.join(join_names)}")
            
            if to_leave:
                supabase.table("group_memberships").delete().eq("player_id", player_id).in_("group_id", to_leave).execute()
                responses.append(f"Left: {', '.join(leave_names)}")
            
            send_sms(from_number, " ✅ " + " | ".join(responses), club_id=club_id)
            clear_user_state(from_number)
        except Exception as e:
            log_error(
                error_type="sms_command",
                error_message=f"Failed to update group memberships: {e}",
                phone_number=from_number,
                player_id=player_id,
                club_id=club_id,
                handler_name="handle_group_browsing_response",
                exception=e
            )
            send_sms(from_number, "Sorry, something went wrong updating your groups.", club_id=club_id)
            clear_user_state(from_number)
    else:
        send_sms(from_number, "Invalid selection. Please reply with a number from the list or text RESET.", club_id=club_id)

