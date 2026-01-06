from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg
from logic.elo_service import update_match_elo
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from logic_utils import get_now_utc, normalize_score
from logic.reasoner import resolve_names_with_ai

def handle_result_report(from_number: str, player: Dict, entities: Dict[str, Any], cid: str = None):
    """
    Attempts to identify the match, verify teams, and apply Elo updates.
    """
    from logic_utils import get_match_participants
    player_id = player["player_id"]
    club_id = cid or player.get("club_id")
    
    # 1. Find the most recent confirmed or completed match for this player
    # Look for matches in the last 24 hours
    since = (get_now_utc() - timedelta(hours=24)).isoformat()
    
    # Phase 4: Query match_participations first
    parts_res = supabase.table("match_participations").select("match_id").eq("player_id", player_id).in_("status", ["confirmed", "completed"]).execute()
    match_ids = [p['match_id'] for p in parts_res.data] if parts_res.data else []
    
    match_res = None
    if match_ids:
        match_res = supabase.table("matches").select("*")\
            .in_("match_id", match_ids)\
            .order("scheduled_time", desc=True)\
            .limit(1)\
            .execute()
    
    if not match_res or not match_res.data:
        send_sms(from_number, "I couldn't find a recent match to report a result for.", club_id=club_id)
        return

    match = match_res.data[0]
    match_id = match["match_id"]
    
    # 2. Extract Result Info
    score = entities.get("score")
    winner_str = str(entities.get("winner", "")).lower()
    team_a_names = entities.get("team_a", [])
    team_b_names = entities.get("team_b", [])
    
    # NEW: If team_a is empty but winner_str contains names, try to extract them
    if not team_a_names and winner_str:
        # Check if winner_str is just a keyword or contains names
        keywords = ["we", "me", "i", "a", "b", "them", "opponent", "team 1", "team 2"]
        if not any(k == winner_str.strip() for k in keywords):
            # Try to split by common separators
            potential_winners = re.split(r'\s+and\s+|\s*,\s*|\s*\&\s*', winner_str)
            # Remove "won" or other noise if present
            potential_winners = [re.sub(r'\bwon\b|\bbeaten\b|\bbeat\b', '', w).strip() for w in potential_winners if w.strip()]
            if potential_winners:
                team_a_names = potential_winners
                print(f"[RESULT_HANDLER] Extracted potential names from winner_str: {team_a_names}")

    if not score or not winner_str:
        send_sms(from_number, "I caught that you're reporting a result, but I couldn't understand the score or who won. Could you try again? (e.g. 'We won 6-4 6-2')", club_id=club_id)
        return

    # 3. Team Verification Logic
    parts = get_match_participants(match_id)
    all_pids = parts["all"]
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
        t1_names = [p_map.get(pid, "Unknown") for pid in parts["team_1"]]
        t2_names = [p_map.get(pid, "Unknown") for pid in parts["team_2"]]
        
        players_list = ", ".join([p["name"] for p in players_data])
        msg_clarify = f"I found the match, but I'm having trouble identifying which players are on which teams from your message. Could you clarify? (e.g. 'Adam and John won 6-4 6-2')\n\nPlayers in this match:\n{players_list}"
        send_sms(from_number, msg_clarify, club_id=club_id)
        return

    # 4. Resolve Teams from Match Record (Source of Truth: match_participations)
    participants = get_match_participants(match_id)
    match_t1 = set(participants["team_1"])
    match_t2 = set(participants["team_2"])
    
    teams_verified = False
    is_flipped = False # If True, "Team A" (reporter's team) corresponds to DB Team 2

    # If they mentioned names, try to verify which match team they correspond to
    if resolved_a or resolved_b:
        # Check if resolved_a matches Team 1 or Team 2
        set_a = set(resolved_a)
        set_b = set(resolved_b)
        
        # Scenario A: team_a maps to match_t1
        if set_a.issubset(match_t1) and (not set_b or set_b.issubset(match_t2)):
            # Team A is Match Team 1
            teams_verified = True
            is_flipped = False
        # Scenario B: team_a maps to match_t2
        elif set_a.issubset(match_t2) and (not set_b or set_b.issubset(match_t1)):
            # Team A is Match Team 2
            teams_verified = True
            is_flipped = True
        else:
            # Ambiguous or mismatched
            p_map = {p["player_id"]: p["name"] for p in players_data}
            t1_names = [p_map.get(pid, "Unknown") for pid in match_t1]
            t2_names = [p_map.get(pid, "Unknown") for pid in match_t2]
            
            msg_clarify = "I caught that you're reporting a result, but I'm having trouble identifying the teams based on your message."
            msg_clarify += f"\n\nAs a reminder, the match was:\nTeam 1: {', '.join(t1_names)}\nTeam 2: {', '.join(t2_names)}"
            msg_clarify += "\n\nCould you please clarify who won? (e.g. 'Team 1 won 6-4 6-2' or 'Dave and I beat Sarah and Mike 6-4 6-2')"
            send_sms(from_number, msg_clarify, club_id=club_id)
            return
    else:
        # No names provided - assume they are reporting for themselves
        # Reasoner/parsing logic:
        # winner_str might be "we", "me", "i", "a", "b", "them"
        pass

    if not teams_verified:
        # If we reach here and haven't verified, it means resolved_a/b were empty
        # If winner_str is "we" or "me" or "i", and the sender is in the match, we can infer.
        if "me" in winner_str or "we" in winner_str or "i " in winner_str or winner_str == "i":
            teams_verified = True
            if player_id in match_t1:
                is_flipped = False # Sender is Team 1
            else:
                is_flipped = True # Sender is Team 2
        else:
            send_sms(from_number, "I caught that you're reporting a result, but I'm having trouble identifying the teams. Could you please clarify? (e.g. 'We won 6-4 6-2')", club_id=club_id)
            return

    # 5. Determine Winner Team Index
    # Base winner: 1 = "Team A/We", 2 = "Team B/They"
    base_winner = 1 
    if "b" in winner_str or "opponent" in winner_str or "them" in winner_str or "lost" in winner_str:
        base_winner = 2
    elif "a" in winner_str or "me" in winner_str or "we" in winner_str or "won" in winner_str:
        base_winner = 1
        
    # Apply Flip
    # If is_flipped is True (Team A = DB Team 2):
    #   If base_winner=1 (A won) -> DB Winner = 2
    #   If base_winner=2 (B won) -> DB Winner = 1
    final_winner = base_winner
    if is_flipped:
        final_winner = 3 - base_winner
        
    # 6. Update Match and Apply Elo
    # 6. Update Match and Apply Elo
    try:
        supabase.table("matches").update({
            "score_text": normalize_score(score),
            "winner_team": final_winner,
            "status": "completed",
            "teams_verified": teams_verified
        }).eq("match_id", match_id).execute()
        
        # Apply Elo updates!
        success = update_match_elo(match_id, final_winner)
        
        if success:
            send_sms(from_number, f"🎾 Result recorded: {score}. Your Sync Rating has been updated! 📈", club_id=club_id)
        else:
            send_sms(from_number, f"🎾 Result recorded: {score}. (Elo calculation pending - team size mismatch).", club_id=club_id)
            
    except Exception as e:
        print(f"Error handling result report: {e}")
        send_sms(from_number, "Sorry, I had trouble recording that result. Please try again later.", club_id=club_id)
