def mock_send_sms(to, body, **kwargs):
    print(f"\n[SMS to {to}]: {body} | kwargs: {kwargs}")

# Monkey patch send_sms BEFORE importing anything else
import twilio_client
twilio_client.send_sms = mock_send_sms

import time
from sms_handler import handle_incoming_sms
from redis_client import clear_user_state
from database import supabase

TEST_PHONE = "+15559998888"

def test_flow():
    print("--- Starting SMS Flow Test ---")
    
    # 1. Cleanup previous test data
    # Delete Match Feedback (Foreign key dependency)
    supabase.table("match_feedback").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("feedback_requests").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete Rating History (FK dependency)
    supabase.table("player_rating_history").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete Player Compatibility (FK dependency)
    supabase.table("player_compatibility").delete().neq("player_1_id", "00000000-0000-0000-0000-000000000000").execute()
    # Delete match_participations (FK dependency)
    supabase.table("match_participations").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    
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
    
    # 4b. Provide Gender
    print("\n> User sends: 'Male'")
    handle_incoming_sms(TEST_PHONE, "Male")
    
    # 4c. Provide Groups
    print("\n> User sends: 'No'")
    handle_incoming_sms(TEST_PHONE, "No")
    
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
        
        # 3. Confirm Match
        print("\n> User sends: 'Yes'")
        handle_incoming_sms(TEST_PHONE, "Yes")
        
        # 9. Verify Match
        print("\n--- Verifying Database (Match) ---")
        # Fetch latest match for this player via match_participations
        parts_res = supabase.table("match_participations") \
            .select("match_id, matches(*)") \
            .eq("player_id", p["player_id"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if parts_res.data:
            match_data = parts_res.data[0]
            m = match_data["matches"]
            print(f"SUCCESS: Match found via participations!")
            print(f"Match ID: {m['match_id']}")
            print(f"Scheduled: {m['scheduled_time']}")
            print(f"Status: {m['status']}")
            
            # Additional Verification
            all_parts = supabase.table("match_participations").select("*").eq("match_id", m['match_id']).execute()
            print(f"SUCCESS: match_participations has {len(all_parts.data)} rows for this match.")
        else:
            print("FAILURE: Match participation not found")

    else:
        print("FAILURE: Player not found in DB")

if __name__ == "__main__":
    test_flow()
