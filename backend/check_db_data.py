import os
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def check_data():
    try:
        players = supabase.table("players").select("*", count="exact").execute()
        matches = supabase.table("matches").select("*", count="exact").execute()
        
        print(f"Players count: {len(players.data)}")
        print(f"Matches count: {len(matches.data)}")
        
        if len(players.data) > 0:
            print("First player:", players.data[0])
            
    except Exception as e:
        print(f"Error checking data: {e}")

if __name__ == "__main__":
    check_data()
