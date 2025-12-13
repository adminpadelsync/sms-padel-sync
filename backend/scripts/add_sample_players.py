
import os
import random
import uuid
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing env vars")
    exit(1)

supabase = create_client(url, key)

# Configuration
TOTAL_PLAYERS = 200
GENDER_DISTRIBUTION = {"male": 0.6, "female": 0.4}
SKILL_DISTRIBUTION = {3.0: 0.3, 3.5: 0.3, 4.0: 0.3, 4.5: 0.1}
CLUB_NAME = "Replay Club"

# Name Lists
MALE_NAMES = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Donald", "Mark", "Paul", "Steven", "Andrew", "Kenneth", "Joshua", "Kevin", "Brian", "George", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Gregory", "Frank", "Alexander", "Raymond", "Patrick", "Jack", "Dennis", "Jerry"]
FEMALE_NAMES = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia", "Kathleen", "Amy", "Shirley", "Angela", "Helen", "Anna", "Brenda", "Pamela", "Nicole", "Emma", "Samantha", "Katherine", "Christine", "Debra", "Rachel", "Catherine", "Carolyn", "Janet", "Ruth", "Maria"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"]


def get_or_create_club(club_name):
    # Check if club exists
    response = supabase.table("clubs").select("*").eq("name", club_name).execute()
    if response.data:
        print(f"Found existing club '{club_name}' with ID: {response.data[0]['club_id']}")
        return response.data[0]['club_id']
    
    # Create club if not exists (though user implied it helps if verify existing, we'll create just in case or fail if strictly needing existing)
    # The requirement said "all belong to Replay Club", implied it should be used.
    # Previous step verified it exists. But safe to have fallback or error.
    print(f"Club '{club_name}' not found. Creating...")
    # Basic dummy data for creation if needed
    new_club = {
        "name": club_name,
        "court_count": 4, # Default
        "phone_number": f"+1555{random.randint(1000000, 9999999)}",
        "settings": {"business_hours": "8am-10pm"}
    }
    data = supabase.table("clubs").insert(new_club).execute()
    return data.data[0]['club_id']

def generate_player(club_id, gender, skill):
    first_name = random.choice(MALE_NAMES) if gender == "male" else random.choice(FEMALE_NAMES)
    last_name = random.choice(LAST_NAMES)
    name = f"{first_name} {last_name} {random.randint(1, 999)}" # Add number to ensure uniqueness if name combos repeat
    
    # Unique phone number generator
    # Using a deterministic but random-looking approach ensures we don't collision loop too much, 
    # but for 200, random is fine.
    phone = f"+1555{random.randint(1000000, 9999999)}"
    
    return {
        "phone_number": phone,
        "name": name,
        "declared_skill_level": skill,
        "adjusted_skill_level": skill,
        "level_confidence_score": 50,
        "club_id": club_id,
        "active_status": True,
        "gender": gender
    }

def main():
    print("Starting sample player generation...")
    club_id = get_or_create_club(CLUB_NAME)
    
    players_to_insert = []
    
    # Calculate counts
    # Total 200
    # Males: 120, Females: 80
    
    # Skill levels for Males (120)
    # 3.0: 30% = 36
    # 3.5: 30% = 36
    # 4.0: 30% = 36
    # 4.5: 10% = 12
    # Total Male = 120
    
    # Skill levels for Females (80)
    # 3.0: 30% = 24
    # 3.5: 30% = 24
    # 4.0: 30% = 24
    # 4.5: 10% = 8
    # Total Female = 80
    
    structure = [
        {"gender": "male", "count": 120, "skills": {3.0: 36, 3.5: 36, 4.0: 36, 4.5: 12}},
        {"gender": "female", "count": 80, "skills": {3.0: 24, 3.5: 24, 4.0: 24, 4.5: 8}}
    ]
    
    for group in structure:
        gender = group['gender']
        for skill, count in group['skills'].items():
            for _ in range(count):
                player = generate_player(club_id, gender, skill)
                players_to_insert.append(player)
                
    print(f"Generated {len(players_to_insert)} players. Inserting into database...")
    
    # Batch insert to avoid huge payload if necessary, but 200 is small enough for one go usually.
    # Supabase might have limits, so let's do batches of 50.
    batch_size = 50
    total_inserted = 0
    
    for i in range(0, len(players_to_insert), batch_size):
        batch = players_to_insert[i:i+batch_size]
        try:
            data = supabase.table("players").insert(batch).execute()
            inserted = len(data.data)
            total_inserted += inserted
            print(f"Inserted batch {i//batch_size + 1}: {inserted} players")
        except Exception as e:
            print(f"Error inserting batch starting at index {i}: {e}")
            # Consider retrying or simple skipping? For this task, failing is info.
    
    print(f"Finished. Total players inserted: {total_inserted}")

if __name__ == "__main__":
    main()
