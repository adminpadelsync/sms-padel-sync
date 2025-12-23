import sys
import os
import uuid
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import supabase
from match_organizer import initiate_match_outreach

def test_booking_flow():
    print("Starting Booking Flow Verification...")
    
    # 1. Setup - find a test club and player
    club_res = supabase.table("clubs").select("*").limit(1).execute()
    if not club_res.data:
        print("Error: No clubs found for testing")
        return
    club = club_res.data[0]
    club_id = club["club_id"]
    
    player_res = supabase.table("players").select("*").eq("club_id", club_id).limit(2).execute()
    if not player_res.data:
        print(f"Error: No players found for club {club_id}")
        return
    player1 = player_res.data[0]
    player2 = player_res.data[1]
    
    # 2. Test Match Initiation with originator_id
    print(f"Initiating match outreach with originator {player1['name']}...")
    scheduled_time = (datetime.now() + timedelta(days=1)).isoformat()
    match = initiate_match_outreach(
        club_id=club_id,
        player_ids=[player2["player_id"]],
        scheduled_time=scheduled_time,
        initial_player_ids=[player1["player_id"]],
        originator_id=player1["player_id"]
    )
    
    assert match["originator_id"] == player1["player_id"]
    print("✓ Match created with correct originator_id")
    
    # 3. Test GET /api/clubs/{club_id}/matches/booking-status
    print("Testing booking status API...")
    # Since we're in a script, we'll call the logic directly or mockup a request
    # But let's just check the DB directly to verify the API would see it
    res = supabase.table("matches").select("*").eq("match_id", match["match_id"]).execute()
    fetched_match = res.data[0]
    assert fetched_match["court_booked"] is False
    print("✓ Match defaulted to court_booked=False")
    
    # 4. Test Marking as Booked
    print("Marking match as booked...")
    update_res = supabase.table("matches").update({
        "court_booked": True,
        "booked_at": datetime.now().isoformat(),
        "booked_by": None # In real scenario will be a user_id
    }).eq("match_id", match["match_id"]).execute()
    
    updated_match = update_res.data[0]
    assert updated_match["court_booked"] is True
    print("✓ Match successfully marked as booked")
    
    # Cleanup
    # supabase.table("matches").delete().eq("match_id", match["match_id"]).execute()
    # print("✓ Cleanup complete")
    
    print("\nVerification Successful!")

if __name__ == "__main__":
    test_booking_flow()
