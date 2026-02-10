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
    from logic.reasoner import extract_detailed_match_results

    player_id = player["player_id"]
    club_id = cid or player.get("club_id")
    
    print(f"[RESULT_HANDLER] Starting for player={player_id[:12]}... club={club_id}")
    
    # 1. Find the most recent match for this player to report results on.
    # Prefer non-completed matches (confirmed/pending) over already-completed ones.
    parts_res = supabase.table("match_participations").select("match_id").eq("player_id", player_id).in_("status", ["confirmed", "completed"]).execute()
    match_ids = [p['match_id'] for p in parts_res.data] if parts_res.data else []
    
    print(f"[RESULT_HANDLER] Found {len(match_ids)} match participations")
    
    match = None
    if match_ids:
        # First try: find non-completed matches (the ones we actually want to score)
        match_res = supabase.table("matches").select("*, clubs(name)").in_("match_id", match_ids).neq("status", "completed").order("scheduled_time", desc=True).limit(5).execute()
        
        if match_res.data:
            # Pick the match with the most participants (most likely the real one)
            best_match = None
            best_count = 0
            for m in match_res.data:
                p_count = supabase.table("match_participations").select("player_id", count="exact").eq("match_id", m["match_id"]).execute()
                cnt = p_count.count if p_count.count else 0
                print(f"[RESULT_HANDLER] Candidate match={m['match_id'][:12]}... status={m['status']} participants={cnt}")
                if cnt > best_count:
                    best_count = cnt
                    best_match = m
            match = best_match
        
        # Fallback: if all matches are completed, use the most recent completed one with 4+ participants
        if not match:
            match_res = supabase.table("matches").select("*, clubs(name)").in_("match_id", match_ids).order("scheduled_time", desc=True).limit(5).execute()
            if match_res.data:
                for m in match_res.data:
                    p_count = supabase.table("match_participations").select("player_id", count="exact").eq("match_id", m["match_id"]).execute()
                    cnt = p_count.count if p_count.count else 0
                    print(f"[RESULT_HANDLER] Fallback candidate match={m['match_id'][:12]}... status={m['status']} participants={cnt}")
                    if cnt >= 4:
                        match = m
                        break
                # If still nothing with 4 players, just use the most recent
                if not match and match_res.data:
                    match = match_res.data[0]
    
    if not match:
        send_sms(from_number, "I couldn't find a recent match to report a result for.", club_id=club_id)
        return

    original_match_id = match["match_id"]
    scheduled_time = match["scheduled_time"]
    
    print(f"[RESULT_HANDLER] Selected match={original_match_id[:12]}... scheduled={scheduled_time} status={match.get('status')}")
    
    # Get all players in the session
    parts = get_match_participants(original_match_id)
    all_pids = parts["all"]
    players_data = supabase.table("players").select("player_id, name").in_("player_id", all_pids).execute().data or []
    
    print(f"[RESULT_HANDLER] Match players ({len(players_data)}): {[p['name'] for p in players_data]}")
    print(f"[RESULT_HANDLER] Teams: team_1={parts.get('team_1', [])}, team_2={parts.get('team_2', [])}")
    
    msg_body = entities.get("_raw_message", "")
    detailed_results = []
    
    print(f"[RESULT_HANDLER] Raw message body: '{msg_body[:100]}...' " if msg_body else "[RESULT_HANDLER] No _raw_message in entities")
    print(f"[RESULT_HANDLER] Entities keys: {list(entities.keys())}")
    
    if msg_body:
        detailed_results = extract_detailed_match_results(msg_body, players_data, player_id)
        print(f"[RESULT_HANDLER] LLM extracted {len(detailed_results)} results: {detailed_results}")
        
    if not detailed_results:
        # Fallback to existing single-match logic (but we still need to handle draws/swaps if manually parsed?)
        # For now, if no detailed results from LLM, we use the simple entities.
        score = entities.get("score")
        winner_str = str(entities.get("winner", "")).lower()
        
        if not score or not winner_str:
             send_sms(from_number, "I caught that you're reporting a result, but I couldn't understand the score or who won. Could you try again? (e.g. 'We won 6-4 6-2')", club_id=club_id)
             return

        # Simple extraction didn't work for multi-match, so we just process as one match.
        # But we need to handle "Draw".
        final_winner = 1 # Default
        teams_verified = False
        
        # ... (Existing team verification logic would go here, simplified for brevity in this plan) ...
        # If we want to support Draws in simple mode:
        if "draw" in winner_str or "tie" in winner_str:
            final_winner = 0
            teams_verified = True # Ambiguous who is team 1/2 in a draw, but it doesn't matter for 0.5/0.5
        
        detailed_results.append({
            "score": normalize_score(score),
            "winner": "draw" if final_winner == 0 else "team_1", # Logic below will map this
            # We don't have specific teams here, relies on existing match structure
            "use_existing_teams": True,
            "winner_team_index": final_winner
        })

    # 3. Process Results
    results_processed = 0
    
    for i, res in enumerate(detailed_results):
        print(f"[RESULT_HANDLER] Processing result {i}: {res}")
        # Determine Match ID (First result uses existing match, others create new)
        current_match_id = original_match_id
        is_new_match = False
        
        if i > 0:
            # Create new match for subsequent results
            # We perform a direct insert to avoid triggering invites
            new_match_data = {
                "club_id": club_id,
                "scheduled_time": scheduled_time, # Same time
                "status": "completed",
                "created_at": get_now_utc().isoformat(),
                "originator_id": player_id
            }
            try:
                ins = supabase.table("matches").insert(new_match_data).execute()
                if ins.data:
                    current_match_id = ins.data[0]["match_id"]
                    is_new_match = True
                    print(f"[RESULT_HANDLER] Created new match={current_match_id[:12]}...")
                else:
                    print(f"[RESULT_HANDLER] Failed to create secondary match: no data returned")
                    continue
            except Exception as e:
                print(f"[RESULT_HANDLER] Failed to create secondary match: {e}")
                continue

        # Determine Teams and Winner
        winner_val = 1
        if res.get("winner") == "draw":
            winner_val = 0
        elif res.get("winner") == "team_2":
            winner_val = 2
            
        score_text = normalize_score(res.get("score", ""))
        
        # Resolve teams — handle partial/missing team data from LLM
        t1 = res.get("team_1", [])
        t2 = res.get("team_2", [])
        
        # If team_2 is empty but team_1 has players, infer team_2 from remaining players
        if t1 and not t2:
            t2 = [pid for pid in all_pids if pid not in t1]
            print(f"[RESULT_HANDLER] Inferred team_2={t2} from remaining players")
        
        # If neither team is set, use existing match teams
        if not t1 and not t2:
            t1 = parts.get("team_1", [])
            t2 = parts.get("team_2", [])
            print(f"[RESULT_HANDLER] Using existing match teams: t1={t1}, t2={t2}")
        
        print(f"[RESULT_HANDLER] Result {i}: score={score_text}, winner_val={winner_val}, team_1={t1}, team_2={t2}")
        
        # Update participation if we have valid teams (2 per side)
        if len(t1) == 2 and len(t2) == 2:
            if is_new_match:
                # Insert participants for new match
                parts_data = []
                for p in t1: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 1, "status": "confirmed"})
                for p in t2: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 2, "status": "confirmed"})
                supabase.table("match_participations").insert(parts_data).execute()
                print(f"[RESULT_HANDLER] Inserted participations for new match {current_match_id[:12]}...")
            else:
                # Update existing match participants
                current_parts = get_match_participants(current_match_id)
                supabase.table("match_participations").delete().eq("match_id", current_match_id).execute()
                parts_data = []
                for p in t1: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 1, "status": "confirmed"})
                for p in t2: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 2, "status": "confirmed"})
                supabase.table("match_participations").insert(parts_data).execute()
                print(f"[RESULT_HANDLER] Updated participations for match {current_match_id[:12]}...")
        else:
            print(f"[RESULT_HANDLER] WARNING: Invalid team sizes t1={len(t1)}, t2={len(t2)} - skipping participation update")

        # Update Match Status and Score
        supabase.table("matches").update({
            "score_text": score_text,
            "winner_team": winner_val,
            "status": "completed",
            "teams_verified": True
        }).eq("match_id", current_match_id).execute()
        print(f"[RESULT_HANDLER] Updated match status to completed, score={score_text}")
        
        # Update Elo
        elo_success = update_match_elo(current_match_id, winner_val)
        print(f"[RESULT_HANDLER] Elo update for match {current_match_id[:12]}...: success={elo_success}")
        if elo_success:
            results_processed += 1

    # 4. Send Confirmation
    print(f"[RESULT_HANDLER] Final: results_processed={results_processed} out of {len(detailed_results)} results")
    if results_processed > 0:
        msg = f"🎾 {results_processed} match result{'s' if results_processed > 1 else ''} recorded! Ratings updated. 📈"
        if results_processed > 1:
            msg += "\n(Separate matches created for each result)"
        send_sms(from_number, msg, club_id=club_id)
    else:
        send_sms(from_number, "I couldn't verify the teams or scores. Please try again.", club_id=club_id)

