import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Create a robust mock for twilio
mock_twilio = MagicMock()
sys.modules["twilio"] = mock_twilio
sys.modules["twilio.rest"] = MagicMock()
sys.modules["twilio.base"] = MagicMock()
sys.modules["twilio.base.exceptions"] = MagicMock()

# Mock redis
sys.modules["redis"] = MagicMock()

# Mock other potentially missing modules
sys.modules["pint"] = MagicMock()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock redis_client and twilio_client before they are imported
mock_redis_client = MagicMock()
mock_redis_client.get_user_state.return_value = {}
sys.modules["redis_client"] = mock_redis_client

mock_twilio_client = MagicMock()
sys.modules["twilio_client"] = mock_twilio_client

# Now we can safely import from backend
from database import supabase
from sms_handler import handle_incoming_sms

def verify_result_flow():
    print("Starting Result Flow Verification...")
    
    # 1. Setup Test Data
    club_name = "Test Elo Club " + datetime.now().strftime("%H%M%S")
    club_phone = f"+1999{datetime.now().strftime('%H%M%S')}"
    club_id = supabase.table("clubs").insert({
        "name": club_name, 
        "active": True, 
        "court_count": 4,
        "phone_number": club_phone
    }).execute().data[0]["club_id"]
    
    # Create 4 test players
    p_ids = []
    phones = [f"+1999{datetime.now().strftime('%H%M%S')}{i}" for i in range(4)]
    for i, phone in enumerate(phones):
        pid = supabase.table("players").insert({
            "phone_number": phone,
            "name": f"Elo Player {i+1}",
            "club_id": club_id,
            "declared_skill_level": 3.5,
            "adjusted_skill_level": 3.5,
            "elo_rating": 1500,
            "active_status": True,
            "elo_confidence": 0
        }).execute().data[0]["player_id"]
        p_ids.append(pid)

    # 2. Create Confirmed Match
    match_id = supabase.table("matches").insert({
        "club_id": club_id,
        "team_1_players": [p_ids[0], p_ids[1]],
        "team_2_players": [p_ids[2], p_ids[3]],
        "status": "confirmed",
        "scheduled_time": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "originator_id": p_ids[0]
    }).execute().data[0]["match_id"]
    
    print(f"Match created: {match_id}")

    # Simulate SMS: "Elo Player 2 and I beat Elo Player 3 and Elo Player 4 6-4 6-2" from Player 1
    # Note: Player names must match the test data names
    print(f"Simulating SMS from {phones[0]}: 'Elo Player 2 and I beat Elo Player 3 and Elo Player 4 6-4 6-2'")
    
    handle_incoming_sms(from_number=phones[0], body="Elo Player 2 and I beat Elo Player 3 and Elo Player 4 6-4 6-2", to_number=club_phone)

    # 4. Verify Results
    match_final = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
    
    if match_final["status"] != "completed":
        print(f"❌ Match status is {match_final['status']}, expected completed.")
        # If Gemini is not set up, it might fail to detect intent.
        # But in theory, the environment HAS Gemini keys if it's running PadelSync.
        return False

    assert match_final["winner_team"] == 1
    assert match_final["score_text"] == "6-4 6-2"
    print("✅ Match status updated to completed")
    
    # Verify Elo updates
    p1_final = supabase.table("players").select("elo_rating, elo_confidence, adjusted_skill_level").eq("player_id", p_ids[0]).execute().data[0]
    p3_final = supabase.table("players").select("elo_rating, elo_confidence, adjusted_skill_level").eq("player_id", p_ids[2]).execute().data[0]
    
    print(f"Final Ratings: P1={p1_final['elo_rating']} (conf={p1_final['elo_confidence']}), P3={p3_final['elo_rating']} (conf={p3_final['elo_confidence']})")
    
    if p1_final["elo_rating"] > 1500 and p1_final["elo_confidence"] == 1:
        print("✅ Elo ratings updated correctly!")
        return True
    else:
        print("❌ Elo ratings NOT updated as expected.")
        return False

if __name__ == "__main__":
    try:
        success = verify_result_flow()
        if success:
            print("\nINTEGRATION TEST PASSED!")
        else:
            print("\nINTEGRATION TEST FAILED!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
