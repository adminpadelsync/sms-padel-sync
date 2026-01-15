import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Path setup
backend_dir = os.path.join(os.getcwd(), 'backend')
load_dotenv(os.path.join(backend_dir, '.env'))

def debug_club_visibility():
    url = os.environ.get("SUPABASE_URL_TEST")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not url or not key:
        print("Error: Missing TEST credentials.")
        return

    supabase: Client = create_client(url, key)
    
    print(f"Checking clubs in {url}...")
    
    try:
        # 1. Check all clubs
        res = supabase.table("clubs").select("*").execute()
        print(f"\n--- CLUBS TABLE ({len(res.data)} records) ---")
        for club in res.data:
            print(f"ID: {club['club_id']} | Name: {club['name']} | Active: {club['active']} | Phone: {club['phone_number']}")

        # 2. Check the Superuser record
        email = "adam@the-rogers.com"
        user_res = supabase.table("users").select("*").eq("email", email).maybe_single().execute()
        print(f"\n--- USER RECORD ({email}) ---")
        if user_res.data:
            print(f"ID: {user_res.data['user_id']} | Superuser: {user_res.data['is_superuser']} | Role: {user_res.data['role']}")
        else:
            print("User not found in users table!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_club_visibility()
