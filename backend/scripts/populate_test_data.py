
"""
Script to populate test data for the Recommendation Engine.
Generates players with diverse profiles:
- Skill levels (0.25 increments)
- Structured availability preferences
- Pro verification status
- Scoring history (responsiveness, reputation)
"""

import sys
import os
import random
from datetime import datetime, timedelta
import uuid

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import supabase

def generate_phone_number():
    """Generate a fake but valid-looking US phone number."""
    return f"+1555{random.randint(1000000, 9999999)}"

def populate_test_players(club_id: str, count: int = 20):
    print(f"Generating {count} test players for club {club_id}...")
    
    first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", 
                   "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    
    levels = [2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0]
    
    created_count = 0
    
    for _ in range(count):
        gender = random.choice(["male", "female"])
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        
        # Skill level
        level = random.choice(levels)
        
        # Pro verification (30% chance)
        pro_verified = random.random() < 0.3
        
        # Availability profiles
        avail_profile = random.choice(["morning_person", "afterwork", "weekend_warrior", "anytime", "flexible"])
        
        avail_data = {
            "avail_weekday_morning": False,
            "avail_weekday_afternoon": False,
            "avail_weekday_evening": False,
            "avail_weekend_morning": False,
            "avail_weekend_afternoon": False,
            "avail_weekend_evening": False
        }
        
        if avail_profile == "morning_person":
            avail_data["avail_weekday_morning"] = True
            avail_data["avail_weekend_morning"] = True
        elif avail_profile == "afterwork":
            avail_data["avail_weekday_evening"] = True
        elif avail_profile == "weekend_warrior":
            avail_data["avail_weekend_morning"] = True
            avail_data["avail_weekend_afternoon"] = True
            avail_data["avail_weekend_evening"] = True
        elif avail_profile == "anytime":
            for k in avail_data:
                avail_data[k] = True
        elif avail_profile == "flexible":
            # Random mix
            for k in avail_data:
                avail_data[k] = random.choice([True, False])
        
        # Simulated Scores
        responsiveness = random.randint(40, 100)
        reputation = random.randint(60, 100)
        
        # Prepare player record (no club_id)
        player_insert = {
            "phone_number": generate_phone_number(),
            "name": name,
            "gender": gender,
            "declared_skill_level": level,
            "adjusted_skill_level": level,
            "active_status": True,
            "pro_verified": pro_verified,
            "pro_verified_at": datetime.utcnow().isoformat() if pro_verified else None,
            "responsiveness_score": responsiveness,
            "reputation_score": reputation,
            "total_invites_received": random.randint(5, 50),
            "total_invites_accepted": random.randint(1, 20),
            **avail_data
        }
        
        try:
            # 1. Insert Player
            res = supabase.table("players").insert(player_insert).execute()
            if res.data:
                player_id = res.data[0]["player_id"]
                # 2. Link to Club
                supabase.table("club_members").insert({
                    "player_id": player_id,
                    "club_id": club_id
                }).execute()
                
                created_count += 1
                print(f"Created {name} ({level}, {gender}) - {avail_profile}")
        except Exception as e:
            print(f"Failed to create {name}: {e}")
            
    print(f"Successfully created {created_count} players.")

if __name__ == "__main__":
    # Get the first club ID
    club_res = supabase.table("clubs").select("club_id").limit(1).execute()
    if not club_res.data:
        print("No clubs found. Create a club first.")
        sys.exit(1)
        
    club_id = club_res.data[0]["club_id"]
    populate_test_players(club_id)
