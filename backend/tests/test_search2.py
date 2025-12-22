import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

# Test search
club_id = "55691410-89de-4f14-8249-972d5fea088d"  # Replay Club

print("All players in club:")
all_players = supabase.table("players").select("*").eq("club_id", club_id).execute()
for p in all_players.data:
    print(f"  - {p['name']} ({p['phone_number']})")

print("\n\nTrying ilike search for 'Adam'...")
result1 = supabase.table("players").select("*").eq("club_id", club_id).ilike("name", "%Adam%").execute()
print(f"Found {len(result1.data)} results:")
for p in result1.data:
    print(f"  - {p['name']}")

print("\n\nTrying ilike search for 'adam' (lowercase)...")
result2 = supabase.table("players").select("*").eq("club_id", club_id).ilike("name", "%adam%").execute()
print(f"Found {len(result2.data)} results:")
for p in result2.data:
    print(f"  - {p['name']}")
