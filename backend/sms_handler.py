from twilio_client import send_sms
from redis_client import get_user_state, set_user_state, clear_user_state
from database import supabase
import sms_constants as msg
from handlers.invite_handler import handle_invite_response
from handlers.match_handler import handle_match_request
from handlers.onboarding_handler import handle_onboarding
from datetime import datetime

def handle_incoming_sms(from_number: str, body: str):
    # 1. Check if user exists in DB
    response = supabase.table("players").select("*").eq("phone_number", from_number).execute()
    player = response.data[0] if response.data else None

    # 2. Get current conversation state from Redis
    state_data = get_user_state(from_number)
    current_state = state_data.get("state") if state_data else None

    # If player exists and no active conversation, check for commands
    if player and not current_state:
        cmd = body.lower().strip()
        
        # Check for Invite Responses FIRST
        # We accept YES/NO or single letters/combinations (A, B, AB)
        # Find the most recent 'sent' invite for this player
        invite_res = supabase.table("match_invites").select("*").eq("player_id", player["player_id"]).eq("status", "sent").order("sent_at", desc=True).limit(1).execute()
        
        if invite_res.data:
            invite = invite_res.data[0]
            # Check if input looks like a response (YES/NO/MAYBE/Letters)
            # Simple heuristic: If it matches a command, we might process it as command, 
            # BUT YES/NO/MAYBE are invite specifics.
            # PLAY/RESET are commands.
            # Letters are voting.
            
            is_response = False
            if cmd in ["yes", "no"] or cmd.startswith("maybe"):
                is_response = True
            elif len(cmd) < 5 and all(c.isalpha() for c in cmd): # A, B, AB...
                # Check if match is voting?
                # For now assume if they have an invite and text short letters, it's a vote
                is_response = True
            
            if is_response:
                handle_invite_response(from_number, body, player, invite)
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
                # Show player's matches
                player_id = player["player_id"]
                print(f"[DEBUG] MATCHES for player {player_id} ({from_number})")
                
                # Get all invites for this player
                invites = supabase.table("match_invites").select("match_id, status").eq("player_id", player_id).execute().data
                print(f"[DEBUG] Found {len(invites) if invites else 0} invites")
                
                if not invites:
                    send_sms(from_number, "📅 You have no match invites. Text PLAY to request a match!")
                    return
                
                # Get match details for each invite
                match_ids = [i["match_id"] for i in invites]
                matches = supabase.table("matches").select("*").in_("match_id", match_ids).execute().data
                print(f"[DEBUG] Found {len(matches) if matches else 0} matches")
                
                # Only show CONFIRMED matches where player is actually in the teams
                confirmed = []
                for m in matches:
                    if m["status"] == "confirmed":
                        all_players = (m.get("team_1_players") or []) + (m.get("team_2_players") or [])
                        if player_id in all_players:
                            confirmed.append(m)
                
                # Show PENDING matches where player has a "sent" invite (can still join)
                pending_invite_match_ids = [i["match_id"] for i in invites if i["status"] == "sent"]
                pending = [m for m in matches if m["status"] == "pending" and m["match_id"] in pending_invite_match_ids]
                
                print(f"[DEBUG] Confirmed: {len(confirmed)}, Pending: {len(pending)}")
                
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
                
                if pending:
                    response += "⏳ PENDING:\n"
                    for m in pending:
                        try:
                            dt = datetime.fromisoformat(m['scheduled_time'].replace('Z', '+00:00'))
                            time_str = dt.strftime("%a, %b %d at %I:%M %p")
                        except:
                            time_str = m['scheduled_time']
                        # Count confirmed players
                        count = len(m.get("team_1_players") or []) + len(m.get("team_2_players") or [])
                        response += f"• {time_str} ({count}/4)\n"
                    response += "\n"
                
                if not confirmed and not pending:
                    response = "📅 No active matches. Text PLAY to request a match!"
                else:
                    response += "Reply YES to join pending matches."
                
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
            send_sms(from_number, msg.MSG_WELCOME_BACK.format(name=player['name']))
            return

    # If no state and no player, start onboarding
    if not current_state:
        if player:
             return
        
        # Start onboarding
        send_sms(from_number, msg.MSG_WELCOME_NEW)
        set_user_state(from_number, msg.STATE_WAITING_NAME)
        return

    # Handle States
    if current_state in [msg.STATE_WAITING_NAME, msg.STATE_WAITING_LEVEL, msg.STATE_WAITING_AVAILABILITY]:
        handle_onboarding(from_number, body, current_state, state_data)

    # --- Match Request Flow ---
    elif current_state == msg.STATE_MATCH_REQUEST_DATE:
        handle_match_request(from_number, body, player)
