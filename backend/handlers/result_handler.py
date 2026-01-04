from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg
from logic.elo_service import update_match_elo
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from logic_utils import get_now_utc
from logic.reasoner import resolve_names_with_ai

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
        if name_lower in ["we", "us"]:
            # This is slightly ambiguous if used without other names, but usually means the sender's team
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
            
        # Priority 4: AI Resolution Fallback
        # If we have no match or multiple matches, let AI try to reason
        ai_res = resolve_names_with_ai(name_lower, players_data)
        if ai_res["player_id"] and ai_res["confidence"] >= 0.8:
            print(f"[RESULT_HANDLER] AI resolved '{name_lower}' to {ai_res['player_id']} (conf: {ai_res['confidence']})")
            return ai_res["player_id"]
            
        return None

    resolved_a = []
    resolved_b = []
    
    if team_a_names:
        for name in team_a_names:
            resolved = resolve_name(name, players_data, player_id)
            if resolved and resolved not in resolved_a:
                resolved_a.append(resolved)
    
    if team_b_names:
        for name in team_b_names:
            resolved = resolve_name(name, players_data, player_id)
            if resolved and resolved not in resolved_b:
                resolved_b.append(resolved)

    # NEW: Safety check - if they mentioned names but we couldn't resolve all of them, clarify.
    if (team_a_names and len(resolved_a) < len(team_a_names)) or (team_b_names and len(resolved_b) < len(team_b_names)):
        p_map = {p["player_id"]: p["name"] for p in players_data}
        t1_names = [p_map.get(pid, "Unknown") for pid in match["team_1_players"]]
        t2_names = [p_map.get(pid, "Unknown") for pid in match["team_2_players"]]
        
        msg_clarify = "I caught that you're reporting a result, but I'm having trouble identifying some of the names mentioned."
        msg_clarify += f"\n\nAs a reminder, the match was:\nTeam 1: {', '.join(t1_names)}\nTeam 2: {', '.join(t2_names)}"
        msg_clarify += "\n\nCould you please clarify? (e.g. 'Team 1 won 6-4 6-2' or 'Dave and I beat Sarah and Mike 6-4 6-2')"
        send_sms(from_number, msg_clarify)
        return

    # 4. Resolve Teams from Match Record
    # We want to map resolved_a and resolved_b to match['team_1_players'] or match['team_2_players']
    match_t1 = set(match["team_1_players"])
    match_t2 = set(match["team_2_players"])
    
    final_team_1 = match["team_1_players"]
    final_team_2 = match["team_2_players"]
    teams_verified = False

    # If they mentioned names, try to verify which match team they correspond to
    if resolved_a or resolved_b:
        # Check if resolved_a matches Team 1 or Team 2
        set_a = set(resolved_a)
        set_b = set(resolved_b)
        
        # Scenario A: team_a maps to match_t1
        if set_a.issubset(match_t1) and (not set_b or set_b.issubset(match_t2)):
            # This is the expected ordering: Team A is Match Team 1, Team B is Match Team 2
            teams_verified = True
            team_1_players = final_team_1
            team_2_players = final_team_2
        # Scenario B: team_a maps to match_t2
        elif set_a.issubset(match_t2) and (not set_b or set_b.issubset(match_t1)):
            # Swapped ordering: Team A is Match Team 2, Team B is Match Team 1
            teams_verified = True
            team_1_players = final_team_2
            team_2_players = final_team_1
            # We also need to swap the winner logic later if they use "Team A/B" winner text
            # But let's keep it simple: we now know who team_1 and team_2 are in the context of this report.
        else:
            # Ambiguous or mismatched
            p_map = {p["player_id"]: p["name"] for p in players_data}
            t1_names = [p_map.get(pid, "Unknown") for pid in match_t1]
            t2_names = [p_map.get(pid, "Unknown") for pid in match_t2]
            
            msg_clarify = "I caught that you're reporting a result, but I'm having trouble identifying the teams based on your message."
            msg_clarify += f"\n\nAs a reminder, the match was:\nTeam 1: {', '.join(t1_names)}\nTeam 2: {', '.join(t2_names)}"
            msg_clarify += "\n\nCould you please clarify who won? (e.g. 'Team 1 won 6-4 6-2' or 'Dave and I beat Sarah and Mike 6-4 6-2')"
            send_sms(from_number, msg_clarify)
            return
    else:
        # No names provided - assume they are reporting for themselves
        # If they just say "I won 6-0", resolved_a should at least have the sender
        # But if the reasoner didn't extract any names, we fall back to clarification or 
        # assume they mean themselves as "Team 1" if they are on Team 1?
        # Let's be safe and clarify if NO names were caught but REPORT_RESULT intent was high.
        # Actually, if winner_str is "we", the reasoner might not put "we" in team_a but set winner="we".
        pass

    if not teams_verified:
        # If we reach here and haven't verified, it means resolved_a/b were empty
        # If winner_str is "we" or "me" or "i", and the sender is in the match, we can infer.
        if "me" in winner_str or "we" in winner_str or "i " in winner_str or winner_str == "i":
            teams_verified = True
            if player_id in match_t1:
                team_1_players = final_team_1
                team_2_players = final_team_2
            else:
                team_1_players = final_team_2
                team_2_players = final_team_1
        else:
            # Still don't know who is who
            send_sms(from_number, "I caught that you're reporting a result, but I'm having trouble identifying the teams. Could you please clarify? (e.g. 'We won 6-4 6-2')")
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

