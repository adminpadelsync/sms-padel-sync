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
    
    best_match = None
    best_score = -1
    status_priority = {"confirmed": 3, "pending": 2, "completed": 0}
    
    for m in matches_res.data:
        p_count_res = (supabase.table("match_participations")
                       .select("player_id", count="exact")
                       .eq("match_id", m["match_id"])
                       .execute())
        p_count = p_count_res.count if p_count_res.count else 0
        s_priority = status_priority.get(m.get("status", ""), 1)
        score = s_priority * 10 + p_count
        
        print(f"[RESULT_HANDLER]   match={m['match_id'][:12]}... status={m.get('status')} players={p_count} score={score}")
        
        if score > best_score:
            best_score = score
            best_match = m
    
    return best_match


def _validate_player_ids(ids: List[str], valid_ids: set) -> List[str]:
    """Filter out any IDs that aren't in the valid set."""
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
    
    t1 = _validate_player_ids(res.get("team_1", []), valid_set)
    t2 = _validate_player_ids(res.get("team_2", []), valid_set)
    
    if len(t1) == 2 and len(t2) < 2:
        t2 = [pid for pid in all_pids if pid not in t1]
        print(f"[RESULT_HANDLER] Inferred team_2 from remaining players: {[pid[:8] for pid in t2]}")
    
    if len(t2) == 2 and len(t1) < 2:
        t1 = [pid for pid in all_pids if pid not in t2]
        print(f"[RESULT_HANDLER] Inferred team_1 from remaining players: {[pid[:8] for pid in t1]}")
    
    if len(t1) != 2 or len(t2) != 2:
        fallback_t1 = existing_parts.get("team_1", [])
        fallback_t2 = existing_parts.get("team_2", [])
        if len(fallback_t1) == 2 and len(fallback_t2) == 2:
            t1, t2 = fallback_t1, fallback_t2
            print(f"[RESULT_HANDLER] Fell back to existing match teams")
        else:
            print(f"[RESULT_HANDLER] WARNING: Could not resolve valid 2v2 teams (t1={len(t1)}, t2={len(t2)})")
    
    return t1, t2


def _is_super_tiebreak(score: str) -> bool:
    """Check if a set score looks like a super tiebreak (first to 10+)."""
    parts = score.replace("(", "").replace(")", "").split("-")
    if len(parts) == 2:
        try:
            a, b = int(parts[0].strip()), int(parts[1].strip())
            return max(a, b) >= 10
        except ValueError:
            pass
    return False


def _determine_set_winner(score: str) -> int:
    """Determine winner from a single set score like '6-3' or '10-8'. Returns 1 or 2."""
    clean = score.split("(")[0].strip()  # Remove tiebreak detail like (5)
    parts = clean.split("-")
    if len(parts) == 2:
        try:
            a, b = int(parts[0].strip()), int(parts[1].strip())
            if a > b:
                return 1
            elif b > a:
                return 2
        except ValueError:
            pass
    return 1  # Default to team_1 if can't determine


def _determine_pairing_winner(sets_data: List[Dict]) -> int:
    """Determine overall pairing winner from set results. Returns 1, 2, or 0 (draw)."""
    t1_wins = sum(1 for s in sets_data if s.get("winner_team") == 1)
    t2_wins = sum(1 for s in sets_data if s.get("winner_team") == 2)
    if t1_wins > t2_wins:
        return 1
    elif t2_wins > t1_wins:
        return 2
    return 0  # Draw (split sets, no tiebreak)


def handle_result_report(from_number: str, player: Dict, entities: Dict[str, Any], cid: str = None):
    """
    Handles score reporting: finds the match, extracts pairings via LLM,
    inserts match_sets rows, assigns teams on original match, and applies Elo per pairing.
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

    match_id = match["match_id"]
    scheduled_time = match["scheduled_time"]
    
    print(f"[RESULT_HANDLER] Selected match={match_id[:12]}... scheduled={scheduled_time} status={match.get('status')}")
    
    # 2. Get all players in this match
    parts = get_match_participants(match_id)
    all_pids = parts["all"]
    players_data = supabase.table("players").select("player_id, name").in_("player_id", all_pids).execute().data or []
    
    print(f"[RESULT_HANDLER] Match has {len(players_data)} players: {[p['name'] for p in players_data]}")
    
    if len(players_data) < 4:
        send_sms(from_number, f"That match only has {len(players_data)} players confirmed. Need 4 players to score a padel match.", club_id=club_id)
        return
    
    # 3. Extract detailed results (pairings) using LLM
    msg_body = entities.get("_raw_message", "")
    pairings = []
    
    if msg_body:
        print(f"[RESULT_HANDLER] Sending to LLM: '{msg_body[:120]}...'")
        pairings = extract_detailed_match_results(msg_body, players_data, player_id)
        print(f"[RESULT_HANDLER] LLM returned {len(pairings)} pairings")
        for i, r in enumerate(pairings):
            print(f"[RESULT_HANDLER]   pairing[{i}]: {r}")
        
    if not pairings:
        # Fallback: use simple entities
        score = entities.get("score")
        winner_str = str(entities.get("winner", "")).lower()
        
        if not score or not winner_str:
            send_sms(from_number, "I caught that you're reporting a result, but I couldn't understand the score or who won. Could you try again? (e.g. 'We won 6-4 6-2')", club_id=club_id)
            return

        final_winner = "draw" if ("draw" in winner_str or "tie" in winner_str) else "team_1"
        score_normalized = normalize_score(score)
        
        # Build a single pairing from the simple entities
        pairings.append({
            "sets": [{"score": s.strip(), "winner": final_winner} for s in score_normalized.split(",") if s.strip()],
            "winner": final_winner,
            "use_existing_teams": True,
        })

    # 4. Clear any existing match_sets for this match (in case of re-report)
    try:
        supabase.table("match_sets").delete().eq("match_id", match_id).execute()
        print(f"[RESULT_HANDLER] Cleared existing match_sets for match {match_id[:12]}...")
    except Exception as e:
        print(f"[RESULT_HANDLER] Note: Could not clear match_sets (table may not exist yet): {e}")

    # 5. Process each pairing → insert match_sets, apply Elo
    set_number = 0
    pairings_processed = 0
    all_set_scores = []  # For building summary score_text
    
    for pairing_idx, pairing in enumerate(pairings):
        # Resolve teams for this pairing
        t1, t2 = _resolve_teams(pairing, all_pids, parts)
        
        if len(t1) != 2 or len(t2) != 2:
            print(f"[RESULT_HANDLER] Skipping pairing {pairing_idx}: invalid teams t1={len(t1)} t2={len(t2)}")
            continue
        
        # Get the sets data from the LLM result
        sets_list = pairing.get("sets", [])
        if not sets_list:
            # Legacy format: single "score" field
            score_str = pairing.get("score", "")
            if score_str:
                for s in score_str.split(","):
                    s = s.strip()
                    if s:
                        sets_list.append({"score": s, "winner": pairing.get("winner", "team_1")})
        
        if not sets_list:
            print(f"[RESULT_HANDLER] Skipping pairing {pairing_idx}: no sets data")
            continue
        
        # Build player name map for summary
        name_map = {p["player_id"]: p["name"].split()[0] for p in players_data}
        t1_names = f"{name_map.get(t1[0], '?')} & {name_map.get(t1[1], '?')}"
        t2_names = f"{name_map.get(t2[0], '?')} & {name_map.get(t2[1], '?')}"
        
        pairing_sets_data = []
        pairing_scores = []
        
        for set_data in sets_list:
            set_number += 1
            set_score = normalize_score(set_data.get("score", "")).strip()
            
            # Determine winner for this set
            set_winner_str = set_data.get("winner", "team_1")
            if set_winner_str == "team_2":
                set_winner = 2
            elif set_winner_str == "draw":
                set_winner = _determine_set_winner(set_score)
            else:
                set_winner = 1
            
            is_tb = _is_super_tiebreak(set_score)
            
            # Insert into match_sets
            set_row = {
                "match_id": match_id,
                "set_number": set_number,
                "team_1_player_1": t1[0],
                "team_1_player_2": t1[1],
                "team_2_player_1": t2[0],
                "team_2_player_2": t2[1],
                "score": set_score,
                "winner_team": set_winner,
                "is_tiebreak": is_tb,
            }
            
            try:
                supabase.table("match_sets").insert(set_row).execute()
                print(f"[RESULT_HANDLER] Inserted set {set_number}: {set_score} winner=team_{set_winner} tb={is_tb}")
            except Exception as e:
                print(f"[RESULT_HANDLER] Error inserting set {set_number}: {e}")
            
            pairing_sets_data.append({"winner_team": set_winner})
            pairing_scores.append(set_score)
        
        # Determine overall pairing winner
        pairing_winner = _determine_pairing_winner(pairing_sets_data)
        
        # Build summary for this pairing
        scores_str = ", ".join(pairing_scores)
        all_set_scores.append(f"{t1_names} vs {t2_names}: {scores_str}")
        
        print(f"[RESULT_HANDLER] Pairing {pairing_idx}: {t1_names} vs {t2_names} → {scores_str} → winner=team_{pairing_winner}")
        
        # Assign teams on the original match for this pairing's Elo calculation
        # Use upsert to avoid duplicate key errors when players appear in multiple pairings
        parts_data = []
        for p in t1:
            parts_data.append({"match_id": match_id, "player_id": p, "team_index": 1, "status": "confirmed"})
        for p in t2:
            parts_data.append({"match_id": match_id, "player_id": p, "team_index": 2, "status": "confirmed"})
        supabase.table("match_participations").upsert(parts_data, on_conflict="match_id,player_id").execute()

        
        # Apply Elo for this pairing (once per pairing, not per set)
        # Temporarily set match winner for Elo calculation
        supabase.table("matches").update({
            "winner_team": pairing_winner,
        }).eq("match_id", match_id).execute()
        
        elo_success = update_match_elo(match_id, pairing_winner)
        print(f"[RESULT_HANDLER] Pairing {pairing_idx}: Elo update success={elo_success}")
        if elo_success:
            pairings_processed += 1
    
    # 6. Update the match with summary info
    summary_score = " | ".join(all_set_scores) if all_set_scores else ""
    
    supabase.table("matches").update({
        "score_text": summary_score,
        "status": "completed",
        "teams_verified": True,
    }).eq("match_id", match_id).execute()
    
    print(f"[RESULT_HANDLER] Done: {pairings_processed}/{len(pairings)} pairings processed. Summary: {summary_score}")

    # 7. Send confirmation
    if pairings_processed > 0:
        result_msg = f"🎾 {pairings_processed} pairing{'s' if pairings_processed > 1 else ''} recorded! Ratings updated. 📈"
        if pairings_processed > 1:
            result_msg += f"\n({pairings_processed} different team configurations scored)"
        send_sms(from_number, result_msg, club_id=club_id)
    else:
        send_sms(from_number, "I couldn't verify the teams or scores. Please try again.", club_id=club_id)
