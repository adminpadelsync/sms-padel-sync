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
