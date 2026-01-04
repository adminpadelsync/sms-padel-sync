from datetime import datetime, timedelta
from database import supabase
from twilio_client import send_sms, get_club_name, set_reply_from, set_club_name
import sms_constants as msg
from logic_utils import parse_iso_datetime, format_sms_datetime, get_now_utc

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
                    # Fetch club_id from match
                    m_res = supabase.table("matches").select("club_id").eq("match_id", match_id).execute()
                    club_id = m_res.data[0]["club_id"] if m_res.data else None
                    send_sms(phone, msg.MSG_UPDATE_JOINED.format(club_name=get_club_name(), name=joiner_name, spots=spots_left), club_id=club_id)
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
            "responded_at": get_now_utc().isoformat()
        }).eq("invite_id", invite["invite_id"]).execute()
        send_sms(from_number, msg.MSG_DECLINE, club_id=player.get("club_id"))
        
        # Immediately invite a replacement player
        from matchmaker import invite_replacement_player
        invite_replacement_player(match_id, count=1)
        return


    if cmd == "maybe" or cmd.startswith("maybe "):
        # Mark as MAYBE
        supabase.table("match_invites").update({
            "status": "maybe",
            "responded_at": get_now_utc().isoformat()
        }).eq("invite_id", invite["invite_id"]).execute()
        
        send_sms(from_number, msg.MSG_MAYBE, club_id=player.get("club_id"))
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
            send_sms(from_number, f"Please reply with valid options (e.g., {', '.join(valid_letters)}).", club_id=player.get("club_id"))
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
        supabase.table("match_invites").update({"status": "accepted", "responded_at": get_now_utc().isoformat()}).eq("invite_id", invite["invite_id"]).execute()
        
        # Add to Match (if not already)
        if player["player_id"] not in match["team_1_players"] and player["player_id"] not in match["team_2_players"]:
                if len(match["team_1_players"]) < 2:
                    new_team_1 = match["team_1_players"] + [player["player_id"]]
                    supabase.table("matches").update({"team_1_players": new_team_1}).eq("match_id", match_id).execute()
                else:
                    new_team_2 = match["team_2_players"] + [player["player_id"]]
                    supabase.table("matches").update({"team_2_players": new_team_2}).eq("match_id", match_id).execute()

        send_sms(from_number, f"Votes received for {', '.join(votes)}! We'll confirm if we get 4 players.", club_id=player.get("club_id"))

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
                    "confirmed_at": get_now_utc().isoformat(),
                    "scheduled_time": opt # Set the winning time
                }).eq("match_id", match_id).execute()
                
                # Notify All
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_player_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                    if p_res.data:
                        send_sms(p_res.data[0]["phone_number"], msg.MSG_MATCH_CONFIRMED.format(club_name=get_club_name(), time=opt), club_id=updated_match["club_id"])
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
                    "responded_at": get_now_utc().isoformat()
                }).eq("invite_id", invite["invite_id"]).execute()
                
                send_sms(from_number, 
                    f"🎾 {get_club_name()}: Sorry, this match is already full! 🏸\n\n"
                    "Text PLAY to request a new match, or reply MATCHES to see your invites.",
                    club_id=player.get("club_id")
                )
                return
            
            # 1. Update Invite
            supabase.table("match_invites").update({
                "status": "accepted", 
                "responded_at": get_now_utc().isoformat()
            }).eq("invite_id", invite["invite_id"]).execute()
            
            # 2. Add to Match (Fill Team 1, then Team 2)
            updates = {}
            if len(match["team_1_players"]) < 2:
                new_team_1 = match["team_1_players"] + [player["player_id"]]
                updates["team_1_players"] = new_team_1
            else:
                new_team_2 = match["team_2_players"] + [player["player_id"]]
                updates["team_2_players"] = new_team_2
            
            # If no originator is set (e.g. admin-initiated match), the first person to join becomes the initiator
            if not match.get("originator_id"):
                updates["originator_id"] = player["player_id"]
                
            if updates:
                supabase.table("matches").update(updates).eq("match_id", match_id).execute()
            
            # 3. Build progressive confirmation message
            new_player_count = current_players + 1
            spots_left = 4 - new_player_count
            
            if new_player_count == 1:
                # First player
                response_msg = f"✅ {get_club_name()}: You're in! You're the first player.\n\nWe'll confirm once we have 4 players."
            elif new_player_count < 4:
                # 2nd or 3rd player - list who's confirmed so far
                # Fetch updated match to get current player IDs
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_confirmed_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                
                # Get player names and levels (including current player)
                player_list_items = []
                for pid in all_confirmed_ids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        player_list_items.append(f"  - {p['name']} ({p['declared_skill_level']})")
                
                player_list = "\n".join(player_list_items) if player_list_items else "  - You!"
                
                # Format time logic
                friendly_time = format_sms_datetime(parse_iso_datetime(updated_match['scheduled_time']), club_id=updated_match['club_id'])

                response_msg = (
                    f"✅ {get_club_name()}: You're in! ({new_player_count}/4 confirmed)\n"
                    f"📅 {friendly_time}\n\n"
                    f"So far:\n{player_list}\n\n"
                    f"We need {spots_left} more player{'s' if spots_left > 1 else ''} to confirm the match."
                )
            else:
                # This is the 4th player - match is now confirmed
                response_msg = None  # Will send the full confirmation message below
            
            if response_msg:
                send_sms(from_number, response_msg, club_id=player.get("club_id"))

            # Notify MAYBE players
            if spots_left > 0:
                notify_maybe_players(match_id, player["name"], spots_left)

            # 4. Check if Full (4 players)
            if new_player_count == 4:
                # Confirm Match!
                supabase.table("matches").update({
                    "status": "confirmed", 
                    "confirmed_at": get_now_utc().isoformat()
                }).eq("match_id", match_id).execute()

                # Mark all other invites for this match as expired so they don't show up in dashboard/refills
                supabase.table("match_invites").update({"status": "expired"})\
                    .eq("match_id", match_id)\
                    .in_("status", ["sent", "pending_sms"])\
                    .execute()
                
                # Fetch updated match for player list and time
                updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
                all_player_ids = updated_match["team_1_players"] + updated_match["team_2_players"]
                
                # Identify initiator (first player in team 1)
                initiator_id = updated_match["team_1_players"][0] if updated_match["team_1_players"] else None
                
                # Fetch club details for the booking link
                from logic_utils import get_booking_url
                club_res = supabase.table("clubs").select("*").eq("club_id", updated_match["club_id"]).execute()
                club = club_res.data[0] if club_res.data else {}
                booking_url = get_booking_url(club)
                club_phone = club.get("main_phone") or club.get("phone_number") or "[Club Phone]"
                club_name = club.get("name", "the club")
                
                # Format the date/time nicely
                friendly_time = format_sms_datetime(parse_iso_datetime(updated_match['scheduled_time']), club_id=updated_match['club_id'])
                
                # Get all player names for the confirmation message
                player_names = []
                for pid in all_player_ids:
                    p_res = supabase.table("players").select("name, declared_skill_level").eq("player_id", pid).execute()
                    if p_res.data:
                        p = p_res.data[0]
                        player_names.append(f"  - {p['name']} ({p['declared_skill_level']})")
                
                players_text = "\n".join(player_names)
                
                # Check for Group Context for sender/naming
                group_id = updated_match.get("target_group_id")
                if group_id:
                    # Get group details
                    group_res = supabase.table("player_groups").select("name, phone_number").eq("group_id", group_id).execute()
                    if group_res.data:
                        group = group_res.data[0]
                        group_name = group["name"]
                        group_phone = group.get("phone_number")
                        
                        # Set combined name for this confirmation sequence
                        club_name = f"{club_name} - {group_name}"
                        set_club_name(club_name)
                        
                        # Set the outgoing sender number to the group's number
                        if group_phone:
                            set_reply_from(group_phone)
                
                # Notify all players
                for pid in all_player_ids:
                    try:
                        p_res = supabase.table("players").select("phone_number").eq("player_id", pid).execute()
                        if not p_res.data:
                            continue
                            
                        phone = p_res.data[0]["phone_number"]
                        
                        # Build the message content based on role
                        if pid == initiator_id:
                            # Booking instructions for the initiator
                            role_text = (
                                f"As the organizer, please book the court here: {booking_url}\n\n"
                                f"Alternatively, call {club_name} at {club_phone} to book directly."
                            )
                        else:
                            # Standard sign-off for others
                            role_text = "See you on the court! 🏸"
                        
                        # Construct final message (clean and professional)
                        confirmation_msg = (
                            f"🎾 {club_name}: MATCH CONFIRMED!\n\n"
                            f"📅 {friendly_time}\n\n"
                            f"👥 Players:\n{players_text}\n\n"
                            f"{role_text}"
                        )
                        
                        send_sms(phone, confirmation_msg, club_id=updated_match["club_id"])
                    except Exception as e:
                        print(f"Error notifying player {pid} of confirmation: {e}")
        return

    elif match["status"] == "confirmed":
        # Match is already confirmed - handle late responses
        if cmd == "yes":
            # Mark this invite as expired so we don't keep picking it up
            supabase.table("match_invites").update({
                "status": "expired",
                "responded_at": get_now_utc().isoformat()
            }).eq("invite_id", invite["invite_id"]).execute()
            
            send_sms(from_number, 
                f"🎾 {get_club_name()}: Sorry, this match is already full! 🏸\n\n"
                "Text PLAY to request a new match, or reply MATCHES to see your invites.",
                club_id=player.get("club_id")
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
    
    send_sms(from_number, msg.MSG_MUTED, club_id=player.get("club_id"))
