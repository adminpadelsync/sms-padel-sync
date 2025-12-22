import time
from sms_handler import handle_incoming_sms
from redis_client import clear_user_state
from database import supabase

TEST_PHONE = "+15559998888"

def mock_send_sms(to, body):
    print(f"\n[SMS to {to}]: {body}")

# Monkey patch send_sms for testing
import twilio_client
twilio_client.send_sms = mock_send_sms

def test_flow():
    print("--- Starting SMS Flow Test ---")
    
    # 1. Cleanup previous test data
    # Delete Invites
    supabase.table("match_invites").delete().neq("invite_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete Match Votes
    supabase.table("match_votes").delete().neq("vote_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete Matches
    supabase.table("matches").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete Players
    clear_user_state(TEST_PHONE)
    supabase.table("players").delete().eq("phone_number", TEST_PHONE).execute()
    
    # 2. Initial Message
    print("\n> User sends: 'Hi'")
    handle_incoming_sms(TEST_PHONE, "Hi")
    
    # 3. Provide Name
    print("\n> User sends: 'John Doe'")
    handle_incoming_sms(TEST_PHONE, "John Doe")
    
    # 4. Provide Level
    print("\n> User sends: 'C'")
    handle_incoming_sms(TEST_PHONE, "C")
    
    # 5. Provide Availability
    print("\n> User sends: 'Weekends'")
    handle_incoming_sms(TEST_PHONE, "Weekends")
    
    # 6. Verify DB (Player)
    print("\n--- Verifying Database (Player) ---")
    res = supabase.table("players").select("*").eq("phone_number", TEST_PHONE).execute()
    if res.data:
        p = res.data[0]
        print(f"SUCCESS: Player created!")
        print(f"Name: {p['name']}")
        
        # --- Test Match Request ---
        print("\n--- Starting Match Request Test ---")
        
        # 7. Send PLAY
        print("\n> User sends: 'PLAY'")
        handle_incoming_sms(TEST_PHONE, "PLAY")
        
        # 8. Send Date
        print("\n> User sends: '2023-12-01 18:00'")
        handle_incoming_sms(TEST_PHONE, "2023-12-01 18:00")
        
        # 9. Verify Match
        print("\n--- Verifying Database (Match) ---")
        # Fetch latest match for this player
        # We need to query matches where team_1_players contains player_id
        # Supabase/PostgREST syntax for array contains is 'cs' (contains)
        matches_res = supabase.table("matches").select("*").contains("team_1_players", [p["player_id"]]).execute()
        
        if matches_res.data:
            m = matches_res.data[-1] # Get last one
            print(f"SUCCESS: Match created!")
            print(f"Match ID: {m['match_id']}")
            print(f"Scheduled: {m['scheduled_time']}")
            print(f"Status: {m['status']}")
        else:
            print("FAILURE: Match not found")

    else:
        print("FAILURE: Player not found in DB")

if __name__ == "__main__":
    test_flow()
