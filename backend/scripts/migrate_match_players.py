import os
import sys
from pathlib import Path

# Add backend to path to use existing modules
backend_path = Path(__file__).parent.parent
sys.path.append(str(backend_path))

from database import supabase

def migrate_data():
    print("--- Starting Data Migration: matches -> match_participations ---")
    
    # 1. Fetch all matches
    matches_res = supabase.table("matches").select("*").execute()
    matches = matches_res.data or []
    print(f"Found {len(matches)} matches to process.")
    
    count_monitor = 0
    count_inserted = 0
    
    for m in matches:
        match_id = m["match_id"]
        t1 = m.get("team_1_players") or []
        t2 = m.get("team_2_players") or []
        
        participations = []
        
        # Team 1
        for pid in t1:
            participations.append({
                "match_id": match_id,
                "player_id": pid,
                "team_index": 1,
                "status": "confirmed"
            })
            
        # Team 2
        for pid in t2:
            participations.append({
                "match_id": match_id,
                "player_id": pid,
                "team_index": 2,
                "status": "confirmed"
            })
            
        if participations:
            try:
                # Upsert to avoid duplicates if run multiple times
                supabase.table("match_participations").upsert(participations, on_conflict="match_id, player_id").execute()
                count_inserted += len(participations)
            except Exception as e:
                print(f"[ERROR] Failed match {match_id}: {e}")
        
        count_monitor += 1
        if count_monitor % 10 == 0:
            print(f"Processed {count_monitor}/{len(matches)} matches...")

    print(f"--- Migration Complete ---")
    print(f"Inserted/Updated {count_inserted} participation records.")

if __name__ == "__main__":
    migrate_data()
