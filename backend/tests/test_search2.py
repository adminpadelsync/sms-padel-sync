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
# Fetch players via club_members junction table
all_members = supabase.table("club_members").select("players(*)").eq("club_id", club_id).execute()
for m in all_members.data:
    p = m['players']
    print(f"  - {p['name']} ({p['phone_number']})")

print("\n\nTrying ilike search for 'Adam'...")
# Joining with players and filtering
result1 = supabase.table("club_members").select("players(*)").eq("club_id", club_id).filter("players.name", "ilike", "%Adam%").execute()
print(f"Found {len(result1.data)} results:")
for m in result1.data:
    print(f"  - {m['players']['name']}")

print("\n\nTrying ilike search for 'adam' (lowercase)...")
result2 = supabase.table("club_members").select("players(*)").eq("club_id", club_id).filter("players.name", "ilike", "%adam%").execute()
print(f"Found {len(result2.data)} results:")
for m in result2.data:
    print(f"  - {m['players']['name']}")
