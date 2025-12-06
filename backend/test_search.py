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

query = supabase.table("players").select("*").eq("club_id", club_id).eq("active_status", True)

# Try the or filter
filter_str = f"name.ilike.%{search_term}%,phone_number.ilike.%{search_term}%"
result = query.or_(filter_str).execute()

print(f"Found {len(result.data)} results:")
for p in result.data:
    print(f"  - {p['name']} ({p['phone_number']})")
