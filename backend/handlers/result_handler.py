from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg
from logic.elo_service import update_match_elo
from typing import Dict, Any, List, Optional
from datetime import datetime

def handle_result_report(from_number: str, player: Dict, entities: Dict[str, Any]):
    """
    Handle match result reporting via SMS.
    Attempts to identify the match, verify teams, and apply Elo updates.
    """
    player_id = player["player_id"]
    
    # 1. Find the most recent confirmed or completed match for this player
    # Look for matches in the last 24 hours
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    
    match_res = supabase.table("matches").select("*").or_(
        f"team_1_players.cs.{{\"{player_id}\"}},team_2_players.cs.{{\"{player_id}\"}}"
    ).eq("status", "confirmed").order("scheduled_time", desc=True).limit(1).execute()
    
    if not match_res.data:
        # Check for already completed matches if they are reporting late
        match_res = supabase.table("matches").select("*").or_(
            f"team_1_players.cs.{{\"{player_id}\"}},team_2_players.cs.{{\"{player_id}\"}}"
        ).eq("status", "completed").order("scheduled_time", desc=True).limit(1).execute()
        
    if not match_res.data:
        send_sms(from_number, "I couldn't find a recent match to report a result for.")
        return

    match = match_res.data[0]
    match_id = match["match_id"]
    
    # 2. Extract Result Info
    score = entities.get("score")
    winner_str = str(entities.get("winner", "")).lower()
    team_a_names = entities.get("team_a", [])
    team_b_names = entities.get("team_b", [])
    
    if not score or not winner_str:
        send_sms(from_number, "I caught that you're reporting a result, but I couldn't understand the score or who won. Could you try again? (e.g. 'We won 6-4 6-2')")
        return

    # 3. Team Verification Logic
    # If the user provided names, we try to match them to the player IDs in the match
    all_pids = match["team_1_players"] + match["team_2_players"]
    players_data = supabase.table("players").select("player_id, name").in_("player_id", all_pids).execute().data or []
    name_to_id = {p["name"].lower(): p["player_id"] for p in players_data}
    # Add "me" and "i" aliases for the sender
    name_to_id["me"] = player_id
    name_to_id["i"] = player_id
    
    final_team_1 = []
    final_team_2 = []
    
    if team_a_names and team_b_names:
        # Try to resolve IDs from names
        for name in team_a_names:
            resolved = name_to_id.get(name.lower())
            if resolved: final_team_1.append(resolved)
        for name in team_b_names:
            resolved = name_to_id.get(name.lower())
            if resolved: final_team_2.append(resolved)
            
    # If we couldn't resolve exactly 2 vs 2, we fallback to existing match teams
    # but adjust winner_team based on "winner" entity
    if len(final_team_1) == 2 and len(final_team_2) == 2:
        # Successfully identified new teams
        team_1_players = final_team_1
        team_2_players = final_team_2
        teams_verified = True
    else:
        # Fallback to existing
        team_1_players = match["team_1_players"]
        team_2_players = match["team_2_players"]
        teams_verified = False
        
    # 4. Determine Winner Team Index
    # Reasoner might return "team_a", "me", "opponents", or names
    winner_team = 1 # Default 
    if "b" in winner_str or "opponent" in winner_str or "them" in winner_str or "lost" in winner_str:
        winner_team = 2
    elif "a" in winner_str or "me" in winner_str or "we" in winner_str or "won" in winner_str:
        winner_team = 1
        
    # 5. Update Match and Apply Elo
    try:
        supabase.table("matches").update({
            "score_text": score,
            "winner_team": winner_team,
            "status": "completed",
            "team_1_players": team_1_players,
            "team_2_players": team_2_players,
            "teams_verified": teams_verified
        }).eq("match_id", match_id).execute()
        
        # Apply Elo updates!
        success = update_match_elo(match_id, winner_team)
        
        if success:
            send_sms(from_number, f"🎾 Result recorded: {score}. Your Sync Rating has been updated! 📈")
        else:
            send_sms(from_number, f"🎾 Result recorded: {score}. (Elo calculation pending - team size mismatch).")
            
    except Exception as e:
        print(f"Error handling result report: {e}")
        send_sms(from_number, "Sorry, I had trouble recording that result. Please try again later.")

from datetime import timedelta
