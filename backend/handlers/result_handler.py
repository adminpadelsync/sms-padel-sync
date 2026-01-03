from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg
from logic.elo_service import update_match_elo
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from logic_utils import get_now_utc

def handle_result_report(from_number: str, player: Dict, entities: Dict[str, Any]):
    """
    Handle match result reporting via SMS.
    Attempts to identify the match, verify teams, and apply Elo updates.
    """
    player_id = player["player_id"]
    
    # 1. Find the most recent confirmed or completed match for this player
    # Look for matches in the last 24 hours
    since = (get_now_utc() - timedelta(hours=24)).isoformat()
    
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
    all_pids = match["team_1_players"] + match["team_2_players"]
    players_data = supabase.table("players").select("player_id, name").in_("player_id", all_pids).execute().data or []
    
    def resolve_name(name_str, players_data, sender_id):
        name_lower = name_str.lower().strip()
        if name_lower in ["me", "i", "myself"]:
            return sender_id
            
        exact_full_matches = []
        exact_first_matches = []
        partial_matches = []
        
        for p in players_data:
            full_name = p["name"].lower()
            first_name = full_name.split(' ')[0]
            
            if name_lower == full_name:
                exact_full_matches.append(p["player_id"])
            elif name_lower == first_name:
                exact_first_matches.append(p["player_id"])
            elif (first_name.startswith(name_lower) or name_lower.startswith(first_name)) and len(name_lower) >= 2:
                partial_matches.append(p["player_id"])
                
        # Priority 1: Exact Full Match
        if len(exact_full_matches) == 1:
            return exact_full_matches[0]
        # Priority 2: Exact First Match (if unique among ALL 4 players)
        if len(exact_first_matches) == 1:
            return exact_first_matches[0]
        # Priority 3: Partial/Shortname Match (if unique among ALL 4 players)
        if len(partial_matches) == 1:
            return partial_matches[0]
            
        return None

    final_team_1 = []
    final_team_2 = []
    
    if team_a_names and team_b_names:
        for name in team_a_names:
            resolved = resolve_name(name, players_data, player_id)
            if resolved and resolved not in final_team_1:
                final_team_1.append(resolved)
        for name in team_b_names:
            resolved = resolve_name(name, players_data, player_id)
            if resolved and resolved not in final_team_2:
                final_team_2.append(resolved)

    # 4. Handle Ambiguity or Incomplete Resolution
    # We must have exactly 2 unique players on each team, and no overlap
    unique_pids = set(final_team_1 + final_team_2)
    
    if len(final_team_1) == 2 and len(final_team_2) == 2 and len(unique_pids) == 4:
        # Success!
        team_1_players = final_team_1
        team_2_players = final_team_2
        teams_verified = True
    else:
        # Ambiguous or incomplete
        # Construct a helpful clarifying question
        p_map = {p["player_id"]: p["name"] for p in players_data}
        # Try to suggest based on what we FOUND
        found_names = [p_map.get(pid, "Unknown") for pid in unique_pids]
        missing_count = 4 - len(unique_pids)
        
        msg_clarify = "I caught that you're reporting a result, but I'm having trouble identifying the teams. "
        if len(final_team_1) > 0 or len(final_team_2) > 0:
            t1_names = [p_map.get(pid, "Unknown") for pid in final_team_1]
            t2_names = [p_map.get(pid, "Unknown") for pid in final_team_2]
            msg_clarify += f"I see Team A as ({', '.join(t1_names) or '?'}) and Team B as ({', '.join(t2_names) or '?'}). "
        
        msg_clarify += "\n\nCould you please clarify the teams? (e.g. 'Dave and I beat Sarah and Mike 6-4 6-2')"
        send_sms(from_number, msg_clarify)
        return

    # 5. Determine Winner Team Index
    winner_team = 1 # Default
    if "b" in winner_str or "opponent" in winner_str or "them" in winner_str or "lost" in winner_str:
        winner_team = 2
    elif "a" in winner_str or "me" in winner_str or "we" in winner_str or "won" in winner_str:
        winner_team = 1
        
    # 6. Update Match and Apply Elo
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

