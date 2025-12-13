import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing env vars")
    exit(1)

supabase = create_client(url, key)

# Update specific players
updates = [
    {"name": "Adam Rogers", "gender": "male"},
    {"name": "Eddie Ventrice", "gender": "male"},
    {"name": "John Doe", "gender": "male"},
    {"name": "Player 1", "gender": "male"},
    {"name": "Player 3", "gender": "male"},
    {"name": "Player 2", "gender": "female"},
    {"name": "Player 4", "gender": "female"},
]

print("Updating player genders...")

for u in updates:
    print(f"Updating {u['name']} to {u['gender']}...")
    supabase.table("players").update({"gender": u["gender"]}).eq("name", u["name"]).execute()

print("Done!")
