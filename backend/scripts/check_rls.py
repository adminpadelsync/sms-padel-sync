import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")

def check_rls():
    if not url or not key:
        print("Missing env vars")
        return

    supabase = create_client(url, key)
    
    try:
        print("Attempting to fetch players with ANON key...")
        players = supabase.table("players").select("*", count="exact").execute()
        print(f"Players count (Anon): {len(players.data)}")
        
        if len(players.data) == 0:
            print("RLS is likely blocking access.")
        else:
            print("RLS is NOT blocking access.")
            
    except Exception as e:
        print(f"Error checking RLS: {e}")

if __name__ == "__main__":
    check_rls()
