import os
import sys
import uuid
from dotenv import load_dotenv

# Add the backend directory to sys.path to allow importing backend modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from database import supabase
from logic.elo_service import update_match_elo

def verify_elo_correction():
    print("--- Verifying Elo Correction Logic ---")
    
    # 1. Find a completed match with 4 players
    match_res = supabase.table("matches").select("*").eq("status", "completed").limit(1).execute()
    if not match_res.data:
        print("No completed matches found for testing.")
        return
    
    match = match_res.data[0]
    match_id = match["match_id"]
    original_winner = match["winner_team"]
    new_winner = 2 if original_winner == 1 else 1
    
    print(f"Testing with Match ID: {match_id}")
    print(f"Original Winner: Team {original_winner}")
    
    # 2. Get initial ratings and match counts for players
    player_ids = match["team_1_players"] + match["team_2_players"]
    players_res = supabase.table("players").select("player_id, name, elo_rating, total_matches_played").in_("player_id", player_ids).execute()
    initial_players = {p["player_id"]: p for p in players_res.data}
    
    print("\nInitial Player State:")
    for pid, p in initial_players.items():
        print(f"  {p['name']}: Elo {p['elo_rating']}, Matches {p['total_matches_played']}")

    # 3. Simulate a correction (re-run update_match_elo with same winner)
    # This should be a "no-op" in terms of match count if we handle it right, 
    # but currently it would increment. Let's see if the reversal logic works.
    print(f"\n--- Re-applying original result (Team {original_winner}) ---")
    update_match_elo(match_id, original_winner)
    
    players_after_reapply = supabase.table("players").select("player_id, name, elo_rating, total_matches_played").in_("player_id", player_ids).execute()
    after_reapply = {p["player_id"]: p for p in players_after_reapply.data}
    
    print("\nState after Re-applying (should be same as initial):")
    for pid, p in after_reapply.items():
        match_count_ok = p["total_matches_played"] == initial_players[pid]["total_matches_played"]
        print(f"  {p['name']}: Elo {p['elo_rating']}, Matches {p['total_matches_played']} (Match Count OK: {match_count_ok})")

    # 4. Simulate a winner flip
    print(f"\n--- Flipping winner to Team {new_winner} ---")
    update_match_elo(match_id, new_winner)
    
    players_after_flip = supabase.table("players").select("player_id, name, elo_rating, total_matches_played").in_("player_id", player_ids).execute()
    after_flip = {p["player_id"]: p for p in players_after_flip.data}
    
    print("\nState after Flipped winner:")
    for pid, p in after_flip.items():
        match_count_ok = p["total_matches_played"] == initial_players[pid]["total_matches_played"]
        rating_changed = p["elo_rating"] != after_reapply[pid]["elo_rating"]
        print(f"  {p['name']}: Elo {p['elo_rating']}, Matches {p['total_matches_played']} (Match Count OK: {match_count_ok}, Rating Changed: {rating_changed})")

    # 5. Restore original winner for safety
    print(f"\nRestoring original winner (Team {original_winner})...")
    update_match_elo(match_id, original_winner)
    print("Verification complete.")

if __name__ == "__main__":
    load_dotenv()
    verify_elo_correction()
