
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

# Check players table columns (indirectly by selecting one row)
try:
    print("Checking players table schema...")
    response = supabase.table("players").select("*").limit(1).execute()
    if response.data:
        print("Columns found:", response.data[0].keys())
        if "gender" in response.data[0]:
            print("SUCCESS: 'gender' column exists.")
        else:
            print("WARNING: 'gender' column NOT found in returned data (might be null).")
    else:
        print("No players found to check schema. Will try to insert a dummy player with gender to test.")

except Exception as e:
    print(f"Error checking players schema: {e}")

# Check Replay Club
try:
    print("\nChecking for 'Replay Club'...")
    response = supabase.table("clubs").select("*").eq("name", "Replay Club").execute()
    if response.data:
        print(f"SUCCESS: 'Replay Club' exists with ID: {response.data[0]['club_id']}")
    else:
        print("INFO: 'Replay Club' does NOT exist.")

except Exception as e:
    print(f"Error checking clubs: {e}")
