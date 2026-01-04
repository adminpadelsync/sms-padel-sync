import sys
import os

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import supabase

def dump_player_matches(player_id):
    print(f"--- Dumping matches for Player: {player_id} ---")
    
    # Fetch all matches and filter in Python
    res = supabase.table("matches").select("*").execute()
    all_matches = res.data or []
    
    matches = []
    for m in all_matches:
        team_1 = m.get("team_1_players") or []
        team_2 = m.get("team_2_players") or []
        if player_id in team_1 or player_id in team_2:
            matches.append(m)
    
    # Sort by scheduled_time
    matches.sort(key=lambda x: x.get("scheduled_time", ""), reverse=True)
    for m in matches:
        print(f"\nMatch ID: {m['match_id']}")
        print(f"Date: {m['scheduled_time']}")
        print(f"Status: {m['status']}")
        print(f"Score: {m['score_text']}")
        print(f"Winner: Team {m['winner_team']}")
        print(f"Team 1: {m['team_1_players']}")
        print(f"Team 2: {m['team_2_players']}")

if __name__ == "__main__":
    # Adam Rogers (googlevoice) ID
    ADAM_ID = 'd6e7d5e5-803d-4094-bea7-2cc4adc15ef9'
    dump_player_matches(ADAM_ID)
