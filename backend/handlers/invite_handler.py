from datetime import datetime, timedelta
from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg

def notify_maybe_players(match_id: str, joiner_name: str, spots_left: int):
    """Notify players who replied MAYBE that someone joined."""
    try:
        # Find maybe players
        maybe_res = supabase.table("match_invites").select("player_id").eq("match_id", match_id).eq("status", "maybe").execute()
        if maybe_res.data:
            for row in maybe_res.data:
                pid = row["player_id"]
                # Get phone
                p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                if p_res.data:
                    phone = p_res.data[0]["phone_number"]
                    send_sms(phone, msg.MSG_UPDATE_JOINED.format(name=joiner_name, spots=spots_left))
    except Exception as e:
        print(f"Error notifying maybe players: {e}")

def handle_invite_response(from_number: str, body: str, player: dict, invite: dict):
    """
    Handle a response to a match invite.
    args:
        from_number: Sender's phone number
        body: The message body
        player: Player dictionary
        invite: The active invite dictionary
    """
    cmd = body.lower().strip()
    match_id = invite["match_id"]
    
    # Handle MUTE command during invite flow
    if cmd == "mute":
        _handle_mute_from_invite(from_number, player)
        return
    
    if cmd == "no":
        # Decline
        supabase.table("match_invites").update({
            "status": "declined", 
            "responded_at": datetime.utcnow().isoformat()
        }).eq("invite_id", invite["invite_id"]).execute()
        send_sms(from_number, msg.MSG_DECLINE)
        
        # Immediately invite a replacement player
        from matchmaker import invite_replacement_player
        invite_replacement_player(match_id, count=1)
        return


    if cmd == "maybe" or cmd.startswith("maybe "):
        # Mark as MAYBE
        supabase.table("match_invites").update({
            "status": "maybe",
            "responded_at": datetime.utcnow().isoformat()
        }).eq("invite_id", invite["invite_id"]).execute()
        
        send_sms(from_number, msg.MSG_MAYBE)
        return

    
    # Check Match Status
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    match = match_res.data[0]

    if match["status"] == "voting":
        # Handle Voting Response (e.g., "A", "B", "AB")
        options = match.get("voting_options", [])
        votes = []
        
        # Map letters to indices
        valid_letters = [chr(65+i) for i in range(len(options))] # A, B, C...
        
        for char in cmd.upper():
            if char in valid_letters:
                idx = ord(char) - 65
                votes.append(options[idx])
        
        if not votes:
            send_sms(from_number, f"Please reply with valid options (e.g., {', '.join(valid_letters)}).")
            return

        # Record Votes
        for v in votes:
            # Check duplicate
            existing = supabase.table("match_votes").select("*").eq("match_id", match_id).eq("player_id", player["player_id"]).eq("selected_option", v).execute()
            if not existing.data:
                supabase.table("match_votes").insert({
                    "match_id": match_id,
                    "player_id": player["player_id"],
                    "selected_option": v
                }).execute()
        
        # Update Invite
        supabase.table("match_invites").update({"status": "accepted", "responded_at": datetime.utcnow().isoformat()}).eq("invite_id", invite["invite_id"]).execute()
        
        # Add to Match (if not already)
        if player["player_id"] not in match["team_1_players"] and player["player_id"] not in match["team_2_players"]:
                if len(match["team_1_players"]) < 2:
                    new_team_1 = match["team_1_players"] + [player["player_id"]]
                    supabase.table("matches").update({"team_1_players": new_team_1}).eq("match_id", match_id).execute()
                else:
                    new_team_2 = match["team_2_players"] + [player["player_id"]]
                    supabase.table("matches").update({"team_2_players": new_team_2}).eq("match_id", match_id).execute()

        send_sms(from_number, f"Votes received for {', '.join(votes)}! We'll confirm if we get 4 players.")

        # Check for Winner (First to 4)
        # Get all votes for this match
        all_votes = supabase.table("match_votes").select("selected_option").eq("match_id", match_id).execute()
        vote_counts = {}
        for row in all_votes.data:
            opt = row["selected_option"]
            vote_counts[opt] = vote_counts.get(opt, 0) + 1
            
            if vote_counts[opt] >= 4:
                # WINNER!
                # Confirm Match
                supabase.table("matches").update({
                    "status": "confirmed", 
                    "confirmed_at": datetime.utcnow().isoformat(),
                    "scheduled_time": opt # Set the winning time
                }).eq("match_id", match_id).execute()
                
                # Notify All
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_player_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                    if p_res.data:
                        send_sms(p_res.data[0]["phone_number"], msg.MSG_MATCH_CONFIRMED.format(club_name=get_club_name(), time=opt))
                return

    elif match["status"] == "pending":
        # Existing YES/NO Logic
        if cmd == "yes":
            # Count current players BEFORE adding
            current_players = len(match["team_1_players"]) + len(match["team_2_players"])
            
            # Check if match is already full
            if current_players >= 4:
                # Mark invite as expired so we don't keep picking it up
                supabase.table("match_invites").update({
                    "status": "expired",
                    "responded_at": datetime.utcnow().isoformat()
                }).eq("invite_id", invite["invite_id"]).execute()
                
                send_sms(from_number, 
                    "Sorry, this match is already full! 🏸\n\n"
                    "Text PLAY to request a new match, or reply MATCHES to see your invites."
                )
                return
            
            # 1. Update Invite
            supabase.table("match_invites").update({
                "status": "accepted", 
                "responded_at": datetime.utcnow().isoformat()
            }).eq("invite_id", invite["invite_id"]).execute()
            
            # 2. Add to Match (Fill Team 1, then Team 2)
            if len(match["team_1_players"]) < 2:
                new_team_1 = match["team_1_players"] + [player["player_id"]]
                supabase.table("matches").update({"team_1_players": new_team_1}).eq("match_id", match_id).execute()
            else:
                new_team_2 = match["team_2_players"] + [player["player_id"]]
                supabase.table("matches").update({"team_2_players": new_team_2}).eq("match_id", match_id).execute()
            
            # 3. Build progressive confirmation message
            new_player_count = current_players + 1
            spots_left = 4 - new_player_count
            
            if new_player_count == 1:
                # First player
                response_msg = "✅ You're in! You're the first player.\n\nWe'll confirm once we have 4 players."
            elif new_player_count < 4:
                # 2nd or 3rd player - list who's confirmed so far
                # Fetch updated match to get current player IDs
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_confirmed_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                
                # Get player names and levels (excluding current player since we're telling THEM)
                other_players = []
                for pid in all_confirmed_ids:
                    if pid != player["player_id"]:
                        p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                        if p_res.data:
                            p = p_res.data[0]
                            other_players.append(f"{p['name']} ({p['declared_skill_level']})")
                
                player_list = ", ".join(other_players) if other_players else "You!"
                response_msg = (
                    f"✅ You're in! ({new_player_count}/4 confirmed)\n\n"
                    f"So far: {player_list}\n\n"
                    f"We need {spots_left} more player{'s' if spots_left > 1 else ''} to confirm the match."
                )
            else:
                # This is the 4th player - match is now confirmed
                response_msg = None  # Will send the full confirmation message below
            
            if response_msg:
                send_sms(from_number, response_msg)

            # Notify MAYBE players
            if spots_left > 0:
                notify_maybe_players(match_id, player["name"], spots_left)

            # 4. Check if Full (4 players)
            if new_player_count == 4:
                # Confirm Match!
                supabase.table("matches").update({
                    "status": "confirmed", 
                    "confirmed_at": datetime.utcnow().isoformat()
                }).eq("match_id", match_id).execute()
                
                # Fetch updated match for player list and time
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_player_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                
                # Format the date/time nicely
                try:
                    dt = datetime.fromisoformat(updated_match['scheduled_time'].replace('Z', '+00:00'))
                    formatted_time = dt.strftime("%A, %b %d at %I:%M %p")
                except:
                    formatted_time = updated_match['scheduled_time']
                
                # Get all player names for the confirmation message
                player_names = []
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        player_names.append(f"{p['name']} ({p['declared_skill_level']})")
                
                players_text = "\n".join([f"  • {name}" for name in player_names])
                
                # Notify all players
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                    if p_res.data:
                        confirmation_msg = (
                            f"🎾 MATCH CONFIRMED at {get_club_name()}!\n\n"
                            f"📅 {formatted_time}\n\n"
                            f"👥 Players:\n{players_text}\n\n"
                            f"See you on the court! 🏸"
                        )
                        send_sms(p_res.data[0]["phone_number"], confirmation_msg)
        return

    elif match["status"] == "confirmed":
        # Match is already confirmed - handle late responses
        if cmd == "yes":
            # Mark this invite as expired so we don't keep picking it up
            supabase.table("match_invites").update({
                "status": "expired",
                "responded_at": datetime.utcnow().isoformat()
            }).eq("invite_id", invite["invite_id"]).execute()
            
            send_sms(from_number, 
                "Sorry, this match is already full! 🏸\n\n"
                "Text PLAY to request a new match, or reply MATCHES to see your invites."
            )
        return


def _handle_mute_from_invite(from_number: str, player: dict):
    """Handle MUTE command from invite response context."""
    if not player:
        return
    
    # Set muted_until to end of today (midnight)
    tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    supabase.table("players").update({
        "muted_until": tomorrow.isoformat()
    }).eq("player_id", player["player_id"]).execute()
    
    send_sms(from_number, msg.MSG_MUTED)
