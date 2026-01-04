import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

# Test search
club_id = "55691410-89de-4f14-8249-972d5fea088d"  # Replay Club
search_term = "Adam Ro"

print(f"Searching for '{search_term}' in club {club_id}...")

# Fetch players via club_members junction table
query = supabase.table("club_members").select("players(*)").eq("club_id", club_id).filter("players.active_status", "eq", True)

# Try the or filter on the joined player table
filter_str = f"players.name.ilike.%{search_term}%,players.phone_number.ilike.%{search_term}%"
result = query.or_(filter_str).execute()

print(f"Found {len(result.data)} results:")
for m in result.data:
    p = m['players']
    print(f"  - {p['name']} ({p['phone_number']})")
