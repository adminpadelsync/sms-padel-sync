from database import supabase
from twilio_client import send_sms, get_club_name
import sms_constants as msg
from logic.elo_service import update_match_elo
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from logic_utils import get_now_utc, normalize_score
from logic.reasoner import resolve_names_with_ai
import re


def _find_best_match_for_player(player_id: str, club_id: str) -> Optional[Dict]:
    """
    Finds the best match for a player to report a score on.
    Strategy: Get all matches this player participates in for this club,
    prefer confirmed (unscored) matches, pick the most recent one with 4 players.
    """
    # Get all match IDs this player is part of (confirmed or completed participation)
    parts_res = (supabase.table("match_participations")
                 .select("match_id")
                 .eq("player_id", player_id)
                 .in_("status", ["confirmed", "completed"])
                 .execute())
    
    if not parts_res.data:
        print(f"[RESULT_HANDLER] No participations found for player {player_id[:12]}...")
        return None
    
    match_ids = list(set(p['match_id'] for p in parts_res.data))
    print(f"[RESULT_HANDLER] Found {len(match_ids)} unique match IDs for player")
    
    # Get all these matches, filtering by club, sorted by most recent first
    matches_res = (supabase.table("matches")
                   .select("*, clubs(name)")
                   .in_("match_id", match_ids)
                   .eq("club_id", club_id)
                   .order("scheduled_time", desc=True)
                   .limit(10)
                   .execute())
    
    if not matches_res.data:
        print(f"[RESULT_HANDLER] No matches found for club {club_id}")
        return None
    
    print(f"[RESULT_HANDLER] Found {len(matches_res.data)} matches in club")
    
    # Score each match: prefer confirmed > pending > completed, and prefer 4 participants
    best_match = None
    best_score = -1
    
    status_priority = {"confirmed": 3, "pending": 2, "completed": 0}
    
    for m in matches_res.data:
        p_count_res = (supabase.table("match_participations")
                       .select("player_id", count="exact")
                       .eq("match_id", m["match_id"])
                       .execute())
        p_count = p_count_res.count if p_count_res.count else 0
        
        # Score: status priority * 10 + participant count
        s_priority = status_priority.get(m.get("status", ""), 1)
        score = s_priority * 10 + p_count
        
        print(f"[RESULT_HANDLER]   match={m['match_id'][:12]}... status={m.get('status')} players={p_count} score={score}")
        
        if score > best_score:
            best_score = score
            best_match = m
    
    return best_match


def _validate_player_ids(ids: List[str], valid_ids: set) -> List[str]:
    """Filter out any IDs that aren't in the valid set (handles LLM returning 'unknown' or bad UUIDs)."""
    valid = []
    for pid in ids:
        if pid in valid_ids:
            valid.append(pid)
        else:
            print(f"[RESULT_HANDLER] Filtering out invalid player ID: {pid}")
    return valid


def _resolve_teams(res: Dict, all_pids: List[str], existing_parts: Dict) -> tuple:
    """
    Resolve team assignments from an LLM result dict.
    Returns (team_1_ids, team_2_ids) with exactly 2 players each if possible.
    """
    valid_set = set(all_pids)
    
    # Get and validate team IDs from LLM response
    t1 = _validate_player_ids(res.get("team_1", []), valid_set)
    t2 = _validate_player_ids(res.get("team_2", []), valid_set)
    
    # If we have team_1 but not team_2, infer team_2 = all players not in team_1
    if len(t1) == 2 and len(t2) < 2:
        t2 = [pid for pid in all_pids if pid not in t1]
        print(f"[RESULT_HANDLER] Inferred team_2 from remaining players: {[pid[:8] for pid in t2]}")
    
    # If we have team_2 but not team_1, infer team_1
    if len(t2) == 2 and len(t1) < 2:
        t1 = [pid for pid in all_pids if pid not in t2]
        print(f"[RESULT_HANDLER] Inferred team_1 from remaining players: {[pid[:8] for pid in t1]}")
    
    # If neither team resolved, fall back to existing match teams
    if len(t1) != 2 or len(t2) != 2:
        fallback_t1 = existing_parts.get("team_1", [])
        fallback_t2 = existing_parts.get("team_2", [])
        if len(fallback_t1) == 2 and len(fallback_t2) == 2:
            t1, t2 = fallback_t1, fallback_t2
            print(f"[RESULT_HANDLER] Fell back to existing match teams")
        else:
            print(f"[RESULT_HANDLER] WARNING: Could not resolve valid 2v2 teams (t1={len(t1)}, t2={len(t2)})")
    
    return t1, t2


def handle_result_report(from_number: str, player: Dict, entities: Dict[str, Any], cid: str = None):
    """
    Attempts to identify the match, verify teams, and apply Elo updates.
    """
    from logic_utils import get_match_participants
    from logic.reasoner import extract_detailed_match_results

    player_id = player["player_id"]
    club_id = cid or player.get("club_id")
    
    print(f"[RESULT_HANDLER] Starting for player={player_id[:12]}... club={club_id}")
    
    # 1. Find the best match to report on
    match = _find_best_match_for_player(player_id, club_id)
    
    if not match:
        send_sms(from_number, "I couldn't find a recent match to report a result for.", club_id=club_id)
        return

    original_match_id = match["match_id"]
    scheduled_time = match["scheduled_time"]
    
    print(f"[RESULT_HANDLER] Selected match={original_match_id[:12]}... scheduled={scheduled_time} status={match.get('status')}")
    
    # 2. Get all players in this match
    parts = get_match_participants(original_match_id)
    all_pids = parts["all"]
    players_data = supabase.table("players").select("player_id, name").in_("player_id", all_pids).execute().data or []
    
    print(f"[RESULT_HANDLER] Match has {len(players_data)} players: {[p['name'] for p in players_data]}")
    
    if len(players_data) < 4:
        send_sms(from_number, f"That match only has {len(players_data)} players confirmed. Need 4 players to score a padel match.", club_id=club_id)
        return
    
    # 3. Extract detailed results using LLM
    msg_body = entities.get("_raw_message", "")
    detailed_results = []
    
    if msg_body:
        print(f"[RESULT_HANDLER] Sending to LLM: '{msg_body[:120]}...'")
        detailed_results = extract_detailed_match_results(msg_body, players_data, player_id)
        print(f"[RESULT_HANDLER] LLM returned {len(detailed_results)} results")
        for i, r in enumerate(detailed_results):
            print(f"[RESULT_HANDLER]   result[{i}]: {r}")
        
    if not detailed_results:
        # Fallback: try to use simple entities (score + winner)
        score = entities.get("score")
        winner_str = str(entities.get("winner", "")).lower()
        
        if not score or not winner_str:
            send_sms(from_number, "I caught that you're reporting a result, but I couldn't understand the score or who won. Could you try again? (e.g. 'We won 6-4 6-2')", club_id=club_id)
            return

        final_winner = 0 if ("draw" in winner_str or "tie" in winner_str) else 1
        
        detailed_results.append({
            "score": normalize_score(score),
            "winner": "draw" if final_winner == 0 else "team_1",
            "use_existing_teams": True,
        })

    # 4. Process each result
    results_processed = 0
    
    for i, res in enumerate(detailed_results):
        current_match_id = original_match_id
        is_new_match = False
        
        if i > 0:
            # Create a new match record for subsequent results (partner swap)
            new_match_data = {
                "club_id": club_id,
                "scheduled_time": scheduled_time,
                "status": "completed",
                "created_at": get_now_utc().isoformat(),
                "originator_id": player_id
            }
            try:
                ins = supabase.table("matches").insert(new_match_data).execute()
                if ins.data:
                    current_match_id = ins.data[0]["match_id"]
                    is_new_match = True
                    print(f"[RESULT_HANDLER] Created secondary match {current_match_id[:12]}...")
                else:
                    print(f"[RESULT_HANDLER] Failed to create secondary match")
                    continue
            except Exception as e:
                print(f"[RESULT_HANDLER] Error creating secondary match: {e}")
                continue

        # Determine winner
        winner_val = 1
        if res.get("winner") == "draw":
            winner_val = 0
        elif res.get("winner") == "team_2":
            winner_val = 2
            
        score_text = normalize_score(res.get("score", ""))
        
        # Resolve teams with validation and inference
        t1, t2 = _resolve_teams(res, all_pids, parts)
        
        print(f"[RESULT_HANDLER] Result {i}: score={score_text} winner_val={winner_val} t1={[pid[:8] for pid in t1]} t2={[pid[:8] for pid in t2]}")
        
        # Update participation if we have valid 2v2 teams
        if len(t1) == 2 and len(t2) == 2:
            if is_new_match:
                parts_data = []
                for p in t1: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 1, "status": "confirmed"})
                for p in t2: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 2, "status": "confirmed"})
                supabase.table("match_participations").insert(parts_data).execute()
            else:
                # Re-assign teams on the existing match
                supabase.table("match_participations").delete().eq("match_id", current_match_id).execute()
                parts_data = []
                for p in t1: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 1, "status": "confirmed"})
                for p in t2: parts_data.append({"match_id": current_match_id, "player_id": p, "team_index": 2, "status": "confirmed"})
                supabase.table("match_participations").insert(parts_data).execute()
            
            print(f"[RESULT_HANDLER] Teams assigned for match {current_match_id[:12]}...")
        else:
            print(f"[RESULT_HANDLER] WARNING: Skipping team assignment — invalid sizes t1={len(t1)} t2={len(t2)}")

        # Update match status and score
        supabase.table("matches").update({
            "score_text": score_text,
            "winner_team": winner_val,
            "status": "completed",
            "teams_verified": True
        }).eq("match_id", current_match_id).execute()
        
        # Update Elo
        elo_success = update_match_elo(current_match_id, winner_val)
        print(f"[RESULT_HANDLER] Result {i}: Elo update success={elo_success}")
        if elo_success:
            results_processed += 1

    # 5. Send confirmation
    print(f"[RESULT_HANDLER] Done: {results_processed}/{len(detailed_results)} results processed")
    if results_processed > 0:
        result_msg = f"🎾 {results_processed} match result{'s' if results_processed > 1 else ''} recorded! Ratings updated. 📈"
        if results_processed > 1:
            result_msg += "\n(Separate matches created for each set with different partners)"
        send_sms(from_number, result_msg, club_id=club_id)
    else:
        send_sms(from_number, "I couldn't verify the teams or scores. Please try again.", club_id=club_id)
