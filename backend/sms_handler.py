from twilio_client import send_sms, set_reply_from, set_club_name
from redis_client import get_user_state, set_user_state, clear_user_state
from database import supabase
import sms_constants as msg
from handlers.invite_handler import handle_invite_response
from handlers.match_handler import handle_match_request
from handlers.onboarding_handler import handle_onboarding
from handlers.feedback_handler import handle_feedback_response
from datetime import datetime
import re

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

    # If player exists and no active conversation, check for commands
    if player and not current_state:
        cmd = body.lower().strip()
        
        # Check for Invite Responses
        # Patterns: YES, NO, MAYBE, 1, 1Y, 1N, 2Y, 2N, A, B, AB (voting)
        # Get ALL active invites for this player (both 'sent' AND 'maybe'), ordered by sent_at DESC (newest first)
        # IMPORTANT: Include 'maybe' so players who said MAYBE can later say YES
        all_invites_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).in_("status", ["sent", "maybe"]).order("sent_at", desc=True).execute()
        all_sent_invites = all_invites_res.data if all_invites_res.data else []
        
        if all_sent_invites:
            # Parse numbered responses: 1, 1Y, 1N, 2, 2Y, 2N, etc.
            numbered_match = re.match(r'^(\d+)([ynm])?$', cmd)
            
            invite_index = None  # 0-based index
            action = None  # 'yes', 'no', 'maybe'
            
            if numbered_match:
                # Numbered response like "1", "1Y", "2N"
                invite_index = int(numbered_match.group(1)) - 1  # Convert to 0-based
                action_char = numbered_match.group(2)
                if action_char == 'y':
                    action = 'yes'
                elif action_char == 'n':
                    action = 'no'
                elif action_char == 'm':
                    action = 'maybe'
                else:
                    action = 'yes'  # Default: just number means YES
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
                # Voting response (A, B, AB) - use most recent invite
                invite_index = 0
                action = cmd  # Pass through for voting handler
            
            if invite_index is not None:
                # Validate index
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
            send_sms(from_number, msg.MSG_REQUEST_DATE)
            set_user_state(from_number, msg.STATE_MATCH_REQUEST_DATE)
            return
        elif cmd == "help" or cmd == "?":
            help_text = (
                "🎾 PADEL SYNC COMMANDS\n\n"
                "MATCH RESPONSES:\n"
                "• YES - Accept invite\n"
                "• NO - Decline invite\n"
                "• MAYBE - Tentative\n\n"
                "MATCH INFO:\n"
                "• MATCHES - View your matches\n"
                "• NEXT - Next confirmed match\n\n"
                "OTHER:\n"
                "• PLAY - Request a match\n"
                "• HELP - Show this message"
            )
            send_sms(from_number, help_text)
            return
        elif cmd == "matches":
            try:
                # Show player's matches with numbered pending invites
                player_id = player["player_id"]
                print(f"[DEBUG] MATCHES for player {player_id} ({from_number})")
                
                # Get all invites for this player, ordered by sent_at DESC for consistent numbering
                all_invites = supabase.table("match_invites").select("match_id, status, invite_id").eq("player_id", player_id).order("sent_at", desc=True).execute().data
                print(f"[DEBUG] Found {len(all_invites) if all_invites else 0} invites")
                
                if not all_invites:
                    send_sms(from_number, "📅 You have no match invites. Text PLAY to request a match!")
                    return
                
                # Get match details for each invite
                match_ids = [i["match_id"] for i in all_invites]
                matches_data = supabase.table("matches").select("*").in_("match_id", match_ids).execute().data
                matches_by_id = {m["match_id"]: m for m in matches_data}
                print(f"[DEBUG] Found {len(matches_data) if matches_data else 0} matches")
                
                # Get current time for filtering past matches
                now = datetime.utcnow()
                
                def is_future_match(match):
                    """Check if match scheduled_time is in the future."""
                    try:
                        scheduled = datetime.fromisoformat(match['scheduled_time'].replace('Z', '+00:00'))
                        # Remove timezone info for comparison
                        scheduled = scheduled.replace(tzinfo=None)
                        return scheduled > now
                    except:
                        return True  # If can't parse, include it
                
                # Only show CONFIRMED matches where player is actually in the teams AND match is in the future
                confirmed = []
                for m in matches_data:
                    if m["status"] == "confirmed" and is_future_match(m):
                        all_players = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        if player_id in all_players:
                            confirmed.append(m)
                
                # Get pending invites in order (newest first = index 0 = number 1)
                # Include BOTH 'sent' AND 'maybe' so players can see and respond to matches they said maybe to
                # Filter out past matches
                pending_invites = [inv for inv in all_invites if inv["status"] in ["sent", "maybe"]]
                pending_matches = []
                for inv in pending_invites:
                    m = matches_by_id.get(inv["match_id"])
                    if m and m["status"] == "pending" and is_future_match(m):
                        pending_matches.append(m)
                
                print(f"[DEBUG] Confirmed: {len(confirmed)}, Pending: {len(pending_matches)}")
                
                response = "📅 Your matches:\n\n"
                
                if confirmed:
                    response += "✅ CONFIRMED:\n"
                    for m in confirmed:
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        response += f"• {time_str}\n"
                        
                        # Add player names with levels
                        all_pids = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        for pid in all_pids:
                            p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                            if p_res.data:
                                p = p_res.data[0]
                                response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                        response += "\n"
                
                if pending_matches:
                    response += "⏳ PENDING (reply with #):\n"
                    for i, m in enumerate(pending_matches, 1):
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        # Count confirmed players
                        all_pids = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        count = len(all_pids)
                        response += f"{i}. {time_str} ({count}/4)\n"
                        
                        # Show who's already in
                        if all_pids:
                            for pid in all_pids:
                                p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                                if p_res.data:
                                    p = p_res.data[0]
                                    response += f"  - {p['name']} ({p['declared_skill_level']})\n"
                        response += "\n"
                    response += "Reply 1Y to join, 1N to decline, etc."
                
                if not confirmed and not pending_matches:
                    response = "📅 No active matches. Text PLAY to request a match!"
                
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
                send_sms(from_number, "📅 No confirmed matches yet. Reply MATCHES to see pending invites!")
                return
            
            match_ids = [i["match_id"] for i in invites]
            matches = supabase.table("matches").select("*").in_("match_id", match_ids).eq("status", "confirmed").order("scheduled_time").limit(1).execute().data
            
            if not matches:
                send_sms(from_number, "📅 No confirmed matches yet. Reply MATCHES to see pending invites!")
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
                    names.append(f"{p['name']} ({p['declared_skill_level']})")
            
            players_text = "\n".join([f"  • {n}" for n in names])
            
            response = (
                f"🎾 Your next match:\n\n"
                f"📅 {time_str}\n\n"
                f"👥 Players:\n{players_text}\n\n"
                f"See you on the court! 🏸"
            )
            send_sms(from_number, response)
            return
        elif cmd == "status":
            send_sms(from_number, "📊 Reply MATCHES to see your match invites with details.")
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
    if current_state in [msg.STATE_WAITING_NAME, msg.STATE_WAITING_LEVEL, msg.STATE_WAITING_AVAILABILITY]:
        handle_onboarding(from_number, body, current_state, state_data, club_id)

    # --- Match Request Flow ---
    elif current_state == msg.STATE_MATCH_REQUEST_DATE:
        handle_match_request(from_number, body, player)

    # --- Feedback Collection Flow ---
    elif current_state == msg.STATE_WAITING_FEEDBACK:
        handle_feedback_response(from_number, body, player, state_data)
