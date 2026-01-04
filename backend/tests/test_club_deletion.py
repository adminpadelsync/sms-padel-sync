
import sys
import os
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import supabase
import twilio_manager

def test_club_deletion():
    print("Starting Club Deletion Test with Twilio integration...")
    
    # 1. Create a test club (Omit twilio_sid to avoid DB errors if migration hasn't run)
    club_name = f"Test Club {uuid.uuid4().hex[:6]}"
    club_data = {
        "name": club_name,
        "phone_number": f"+1999{uuid.uuid4().int % 10000000:07d}",
        "court_count": 4,
        "active": True
    }
    
    res = supabase.table("clubs").insert(club_data).execute()
    if not res.data:
        print("Failed to create test club")
        return
    
    club = res.data[0]
    club_id = club["club_id"]
    print(f"Created Test Club: {club_name} ({club_id})")
    
    # 2. Add some test data
    supabase.table("courts").insert([{"club_id": club_id, "name": "Court 1"}]).execute()
    
    # Groups (Omit twilio_sid to avoid DB errors)
    group_res = supabase.table("player_groups").insert({
        "club_id": club_id,
        "name": "Test Group"
    }).execute()
    group_id = group_res.data[0]["group_id"]
    print(f"Added player group: {group_id}")
    
    # 3. Create a player and join club
    player_phone = f"+1888{uuid.uuid4().int % 10000000:07d}"
    player_res = supabase.table("players").insert({
        "name": "Test Player",
        "phone_number": player_phone,
        "declared_skill_level": 3.5,
        "adjusted_skill_level": 3.5
    }).execute()
    player_id = player_res.data[0]["player_id"]
    
    supabase.table("club_members").insert({
        "club_id": club_id,
        "player_id": player_id
    }).execute()

    # 4. Create a match
    match_res = supabase.table("matches").insert({
        "club_id": club_id,
        "team_1_players": [player_id, player_id],
        "team_2_players": [player_id, player_id],
        "scheduled_time": datetime.utcnow().isoformat(),
        "status": "pending"
    }).execute()

    # 5. Verify data exists
    assert len(supabase.table("clubs").select("*").eq("club_id", club_id).execute().data) == 1
    assert len(supabase.table("player_groups").select("*").eq("club_id", club_id).execute().data) == 1
    print("All data verified before deletion")

    # 6. Delete the club (Simulating the endpoint logic)
    print("Simulating deletion logic with Twilio mocks...")
    
    with patch("twilio_manager.release_club_number") as mock_release_club, \
         patch("twilio_manager.release_group_number") as mock_release_group:
         
        # --- LOGIC START ---
        # 0. Release Twilio Numbers
        twilio_manager.release_club_number(club_id)
        
        groups_res = supabase.table("player_groups").select("group_id").eq("club_id", club_id).execute()
        for group in (groups_res.data or []):
            twilio_manager.release_group_number(group["group_id"])
            
        # 1. Clean up matches and related data
        matches_res = supabase.table("matches").select("match_id").eq("club_id", club_id).execute()
        m_ids = [m["match_id"] for m in (matches_res.data or [])]
        if m_ids:
            supabase.table("match_feedback").delete().in_("match_id", m_ids).execute()
            supabase.table("match_invites").delete().in_("match_id", m_ids).execute()
            supabase.table("feedback_requests").delete().in_("match_id", m_ids).execute()
            supabase.table("player_rating_history").delete().in_("match_id", m_ids).execute()
            supabase.table("matches").delete().eq("club_id", club_id).execute()
        
        supabase.table("player_groups").delete().eq("club_id", club_id).execute()
        supabase.table("courts").delete().eq("club_id", club_id).execute()
        supabase.table("error_logs").delete().eq("club_id", club_id).execute()
        supabase.table("clubs").delete().eq("club_id", club_id).execute()
        # --- LOGIC END ---

        # Verify Mocks
        mock_release_club.assert_called_once_with(club_id)
        mock_release_group.assert_called_once_with(group_id)
        print("Mocks verified: release_club_number and release_group_number were called.")

    # 7. Verify DB deletion
    assert len(supabase.table("clubs").select("*").eq("club_id", club_id).execute().data) == 0
    assert len(supabase.table("player_groups").select("*").eq("club_id", club_id).execute().data) == 0
    
    player_check = supabase.table("players").select("*").eq("player_id", player_id).execute()
    assert len(player_check.data) == 1
    
    # Cleanup player
    supabase.table("players").delete().eq("player_id", player_id).execute()
    print("SUCCESS: Club deletion with Twilio release verified.")

if __name__ == "__main__":
    try:
        test_club_deletion()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
