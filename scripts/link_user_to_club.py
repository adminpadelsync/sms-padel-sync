import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Path setup
backend_dir = os.path.join(os.getcwd(), 'backend')
load_dotenv(os.path.join(backend_dir, '.env'))

def link_superuser_to_club():
    url = os.environ.get("SUPABASE_URL_TEST")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not url or not key:
        print("Error: Missing TEST credentials.")
        return

    supabase: Client = create_client(url, key)
    
    email = "adam@the-rogers.com"
    
    try:
        # 1. Find User ID
        user_res = supabase.table("users").select("user_id").eq("email", email).single().execute()
        user_id = user_res.data["user_id"]
        
        # 2. Find newest Club ID
        club_res = supabase.table("clubs").select("club_id, name").order("created_at", desc=True).limit(1).execute()
        if not club_res.data:
            print("No clubs found to link.")
            return
        
        club = club_res.data[0]
        club_id = club["club_id"]
        club_name = club["name"]

        print(f"Linking Superuser ({email}) to newest club: {club_name} ({club_id})...")

        # 3. Upsert into user_clubs
        supabase.table("user_clubs").upsert({
            "user_id": user_id,
            "club_id": club_id,
            "role": "club_admin"
        }).execute()
        
        # 4. Also update the legacy club_id on the user record for safety
        supabase.table("users").update({"club_id": club_id}).eq("user_id", user_id).execute()

        print("✅ Success! The club should now appear in your switcher and management list.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    link_superuser_to_club()
