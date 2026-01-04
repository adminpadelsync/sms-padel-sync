import sys
import os

# Ensure the backend directory is in the path so we can import 'database'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import supabase

def fix_schema():
    print("--- SMS Padel Sync Schema Doctor ---")
    
    # Check Clubs Table
    print("\n[1/2] Checking 'clubs' table...")
    try:
        # Check if twilio_sid exists
        res = supabase.table("clubs").select("twilio_sid").limit(1).execute()
        print("✅ 'twilio_sid' column exists in 'clubs' table.")
    except Exception as e:
        err_str = str(e)
        if "twilio_sid" in err_str or "PGRST204" in err_str:
            print("❌ 'twilio_sid' column is missing from 'clubs'. Attempting to add...")
            try:
                supabase.rpc("run_sql", {"sql": "ALTER TABLE clubs ADD COLUMN IF NOT EXISTS twilio_sid TEXT;"}).execute()
                supabase.rpc("run_sql", {"sql": "CREATE INDEX IF NOT EXISTS idx_clubs_twilio_sid ON clubs(twilio_sid);"}).execute()
                print("✨ Successfully added 'twilio_sid' to 'clubs'.")
            except Exception as sql_err:
                print(f"FAILED to add column via RPC: {sql_err}")
                print("Please run migrations/027_add_club_twilio_sid.sql manually in Supabase SQL Editor.")
        else:
            print(f"Unexpected error checking clubs: {e}")

    # Check Player Groups Table
    print("\n[2/2] Checking 'player_groups' table...")
    try:
        # Check if twilio_sid exists
        res = supabase.table("player_groups").select("twilio_sid").limit(1).execute()
        print("✅ 'twilio_sid' column exists in 'player_groups' table.")
    except Exception as e:
        err_str = str(e)
        if "twilio_sid" in err_str or "PGRST204" in err_str:
            print("❌ 'twilio_sid' column is missing from 'player_groups'. Attempting to add...")
            try:
                supabase.rpc("run_sql", {"sql": "ALTER TABLE player_groups ADD COLUMN IF NOT EXISTS twilio_sid TEXT;"}).execute()
                print("✨ Successfully added 'twilio_sid' to 'player_groups'.")
            except Exception as sql_err:
                print(f"FAILED to add column via RPC: {sql_err}")
                print("Please run migrations/017_add_group_phone_numbers.sql manually in Supabase SQL Editor.")
        else:
            print(f"Unexpected error checking player_groups: {e}")

    print("\n--- Schema Doctor Finished ---")

if __name__ == "__main__":
    fix_schema()
