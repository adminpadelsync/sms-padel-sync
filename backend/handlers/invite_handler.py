from datetime import datetime
from database import supabase
from twilio_client import send_sms
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
    
    if cmd == "no":
        # Decline
        supabase.table("match_invites").update({"status": "declined", "responded_at": datetime.utcnow().isoformat()}).eq("invite_id", invite["invite_id"]).execute()
        send_sms(from_number, msg.MSG_DECLINE)
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
                        send_sms(p_res.data[0]["phone_number"], msg.MSG_MATCH_CONFIRMED.format(time=opt))
                return

    elif match["status"] == "pending":
        # Existing YES/NO Logic
        if cmd == "yes":
            # Accept
            if match["status"] != "pending":
                send_sms(from_number, msg.MSG_MATCH_ALREADY_FULL)
                return
            
            # Count current players
            current_players = len(match["team_1_players"]) + len(match["team_2_players"])
            if current_players >= 4:
                send_sms(from_number, msg.MSG_MATCH_FULL)
                return
            
            # 2. Update Invite
            supabase.table("match_invites").update({"status": "accepted", "responded_at": datetime.utcnow().isoformat()}).eq("invite_id", invite["invite_id"]).execute()
            
            # 3. Add to Match
            # Simple logic: Fill Team 1, then Team 2
            if len(match["team_1_players"]) < 2:
                new_team_1 = match["team_1_players"] + [player["player_id"]]
                supabase.table("matches").update({"team_1_players": new_team_1}).eq("match_id", match_id).execute()
            else:
                new_team_2 = match["team_2_players"] + [player["player_id"]]
                supabase.table("matches").update({"team_2_players": new_team_2}).eq("match_id", match_id).execute()
                
            send_sms(from_number, msg.MSG_YOU_ARE_IN)

            # Notify MAYBE players
            spots_left = 4 - (current_players + 1)
            if spots_left > 0:
                notify_maybe_players(match_id, player["name"], spots_left)

            
            # 4. Check if Full (4 players)
            # We just added one, so check if we hit 4
            if current_players + 1 == 4:
                # Confirm Match!
                supabase.table("matches").update({"status": "confirmed", "confirmed_at": datetime.utcnow().isoformat()}).eq("match_id", match_id).execute()
                
                # Notify all players
                # Fetch updated match to get all IDs
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_player_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                    if p_res.data:
                        send_sms(p_res.data[0]["phone_number"], msg.MSG_MATCH_CONFIRMED.format(time=updated_match['scheduled_time']))
        return
