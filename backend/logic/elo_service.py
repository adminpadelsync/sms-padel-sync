import math
from typing import Dict, List, Tuple
from database import supabase

# Elo constants
BASE_K_FACTOR = 32
PROVISIONAL_K_FACTOR = 64
PROVISIONAL_MATCH_COUNT = 5

def get_expected_score(rating_a: float, rating_b: float) -> float:
    """Calculate expected score for team A."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

def calculate_elo_delta(team_a_elo: float, team_b_elo: float, result: float, k_factor: int = BASE_K_FACTOR) -> int:
    """
    Calculate the Elo rating change.
    result: 1.0 for win, 0.5 for draw, 0.0 for loss
    """
    expected = get_expected_score(team_a_elo, team_b_elo)
    return round(k_factor * (result - expected))

def get_player_k_factor(confidence: int) -> int:
    """Return K-factor based on player experience."""
    if confidence < PROVISIONAL_MATCH_COUNT:
        return PROVISIONAL_K_FACTOR
    return BASE_K_FACTOR

def get_initial_elo(skill_level: float) -> int:
    """Map 2.0-7.0 skill level to Elo."""
    # Based on the formula: Elo = (Skill_Level * 400) + 500
    # 2.5 -> 1500
    # 3.5 -> 1900
    # 5.0 -> 2500
    return int((skill_level * 400) + 500)

def elo_to_sync_rating(elo: int) -> float:
    """Map Elo back to 2.0-7.0 scale for display."""
    # Inverse of the seeding formula: (Elo - 500) / 400
    rating = (elo - 500) / 400
    return round(max(2.0, min(7.0, rating)), 2)

def update_match_elo(match_id: str, winner_team: int):
    """
    Calculates and applies Elo updates for all 4 players in a match.
    Also records the change in player_rating_history.
    """
    # 1. Fetch match and players
    match_res = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not match_res.data:
        return False
    match = match_res.data[0]
    
    team_1_ids = match.get("team_1_players", [])
    team_2_ids = match.get("team_2_players", [])
    
    if len(team_1_ids) != 2 or len(team_2_ids) != 2:
        print(f"Match {match_id} does not have 4 players assigned to teams.")
        return False

    # 2. Fetch player ratings (seeding if missing)
    def get_player_data(pid):
        p_res = supabase.table("players").select("player_id, elo_rating, elo_confidence, declared_skill_level, total_matches_played").eq("player_id", pid).execute()
        if not p_res.data: return None
        p = p_res.data[0]
        if p.get("elo_rating") is None or (p.get("elo_rating") == 1500 and p.get("elo_confidence", 0) == 0):
            p["elo_rating"] = get_initial_elo(float(p.get("declared_skill_level") or 3.5))
        return p

    players_1 = [get_player_data(pid) for pid in team_1_ids]
    players_2 = [get_player_data(pid) for pid in team_2_ids]
    
    if None in players_1 or None in players_2:
        return False

    # 3. Calculate Team Ratings
    team_1_rating = sum(p["elo_rating"] for p in players_1) / 2
    team_2_rating = sum(p["elo_rating"] for p in players_2) / 2

    # 4. Calculate updates for both teams
    updates = []
    
    # Team 1 results
    result_1 = 1.0 if winner_team == 1 else 0.0
    for p in players_1:
        k = get_player_k_factor(p.get("elo_confidence", 0))
        delta = calculate_elo_delta(team_1_rating, team_2_rating, result_1, k)
        
        old_elo = p["elo_rating"]
        old_sync = elo_to_sync_rating(old_elo)
        new_elo = old_elo + delta
        new_sync = elo_to_sync_rating(new_elo)
        
        updates.append({
            "player_id": p["player_id"],
            "old_elo": old_elo,
            "new_elo": new_elo,
            "old_sync": old_sync,
            "new_sync": new_sync,
            "new_confidence": p.get("elo_confidence", 0) + 1,
            "new_matches_played": (p.get("total_matches_played", 0) or 0) + 1
        })

    # Team 2 results
    result_2 = 1.0 - result_1
    for p in players_2:
        k = get_player_k_factor(p.get("elo_confidence", 0))
        delta = calculate_elo_delta(team_2_rating, team_1_rating, result_2, k)
        
        old_elo = p["elo_rating"]
        old_sync = elo_to_sync_rating(old_elo)
        new_elo = old_elo + delta
        new_sync = elo_to_sync_rating(new_elo)
        
        updates.append({
            "player_id": p["player_id"],
            "old_elo": old_elo,
            "new_elo": new_elo,
            "old_sync": old_sync,
            "new_sync": new_sync,
            "new_confidence": p.get("elo_confidence", 0) + 1,
            "new_matches_played": (p.get("total_matches_played", 0) or 0) + 1
        })

    # 5. Apply Updates to DB and Record History
    for up in updates:
        # Update Player
        supabase.table("players").update({
            "elo_rating": up["new_elo"],
            "elo_confidence": up["new_confidence"],
            "adjusted_skill_level": up["new_sync"],
            "total_matches_played": up["new_matches_played"]
        }).eq("player_id", up["player_id"]).execute()

        # Record History Entry
        supabase.table("player_rating_history").insert({
            "player_id": up["player_id"],
            "old_elo_rating": up["old_elo"],
            "new_elo_rating": up["new_elo"],
            "old_sync_rating": up["old_sync"],
            "new_sync_rating": up["new_sync"],
            "change_type": "match_result",
            "match_id": match_id
        }).execute()
        
    return True
