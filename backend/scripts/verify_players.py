
import os
from dotenv import load_dotenv
from supabase import create_client
from collections import Counter

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing env vars")
    exit(1)

supabase = create_client(url, key)

def verify_data():
    print("Verifying player data...")
    
    # Get Replay Club ID
    replay_club = supabase.table("clubs").select("club_id").eq("name", "Replay Club").execute()
    if not replay_club.data:
        print("Error: Replay Club not found during verification.")
        return
        
    club_id = replay_club.data[0]['club_id']
    
    # Fetch all players for this club (limit 1000 to be safe, though 200 is expected)
    response = supabase.table("players").select("gender, declared_skill_level").eq("club_id", club_id).execute()
    players = response.data
    
    total = len(players)
    if total == 0:
        print("No players found for Replay Club.")
        return

    print(f"Total players found in Replay Club: {total}")
    
    # Calculate Gender Distribution
    genders = [p.get('gender') for p in players]
    gender_counts = Counter(genders)
    
    print("\nGender Distribution:")
    for gender, count in gender_counts.items():
        percent = (count / total) * 100
        print(f"  {gender}: {count} ({percent:.1f}%)")
        
    # Calculate Skill Level Distribution
    skills = [float(p.get('declared_skill_level')) for p in players]
    skill_counts = Counter(skills)
    
    print("\nSkill Level Distribution:")
    for skill in sorted(skill_counts.keys()):
        count = skill_counts[skill]
        percent = (count / total) * 100
        print(f"  {skill}: {count} ({percent:.1f}%)")

if __name__ == "__main__":
    verify_data()
