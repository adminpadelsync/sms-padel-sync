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

print("Fetching all players...")
response = supabase.table("players").select("*").execute()
players = response.data

print(f"Found {len(players)} players.")
for p in players:
    print(f"ID: {p.get('player_id')} | Name: {p.get('name')} | Level: {p.get('declared_skill_level')} | Gender: {p.get('gender')} | Club: {p.get('club_id')}")
