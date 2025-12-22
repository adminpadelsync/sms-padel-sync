import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
sys.path.append(os.path.join(os.getcwd(), 'backend/handlers'))

import sms_constants as msg
from handlers.invite_handler import handle_invite_response

@patch('handlers.invite_handler.supabase')
@patch('handlers.invite_handler.send_sms')
def test_match_confirmation_initiator(mock_send_sms, mock_supabase):
    # Setup mocks
    # 1. Fetch invite
    # 2. Update invite
    # 3. Fetch match (pending, gets updated)
    # 4. Update match to confirmed
    # 5. Fetch updated match (now with 4 players)
    # 6. Fetch club
    # 7. Fetch players
    
    match_id = "match123"
    initiator_id = "p1"
    player_ids = ["p1", "p2", "p3", "p4"]
    
    mock_match = {
        "match_id": match_id,
        "club_id": "club123",
        "status": "pending",
        "team_1_players": [initiator_id, "p2"],
        "team_2_players": ["p3"],
        "scheduled_time": "2023-12-25T10:00:00Z"
    }
    
    updated_match = mock_match.copy()
    updated_match["team_2_players"] = ["p3", "p4"]
    updated_match["status"] = "confirmed"
    
    mock_club = {
        "club_id": "club123",
        "name": "Test Club",
        "booking_system": "playbypoint",
        "booking_slug": "testclub",
        "phone_number": "+1112223333"
    }
    
    # Mock chain for select().eq().execute() calls
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[mock_match]), # match fetch (line 65 or line 35 depending on version)
        MagicMock(data=[updated_match]), # updated_match fetch (line 226/220)
        MagicMock(data=[mock_club]), # club fetch (line 231)
        MagicMock(data=[{"name": "Player 1", "declared_skill_level": "4.0"}]), # p1 (line 240)
        MagicMock(data=[{"name": "Player 2", "declared_skill_level": "3.5"}]), # p2
        MagicMock(data=[{"name": "Player 3", "declared_skill_level": "3.0"}]), # p3
        MagicMock(data=[{"name": "Player 4", "declared_skill_level": "3.5"}]), # p4
        MagicMock(data=[{"phone_number": "+1001"}]), # p1 phone (line 251)
        MagicMock(data=[{"phone_number": "+1002"}]), # p2 phone
        MagicMock(data=[{"phone_number": "+1003"}]), # p3 phone
        MagicMock(data=[{"phone_number": "+1004"}]), # p4 phone
    ]
    
    # Mock update().eq().execute() calls
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    
    # Run handle_invite_response for the 4th player
    handle_invite_response("+1004", "yes", {"name": "Player 4", "player_id": "p4"}, {"match_id": match_id, "player_id": "p4", "invite_id": "inv4"})
    
    # Verify initiator received special message
    # Expected booking URL for playbypoint+testclub: https://testclub.playbypoint.com/book/testclub
    expected_url = "https://testclub.playbypoint.com/book/testclub"
    
    # Check if send_sms was called with the organizer message for p1 (+1001)
    calls = [call[0] for call in mock_send_sms.call_args_list]
    organizer_call = next((c for c in calls if c[0] == "+1001"), None)
    
    assert organizer_call is not None
    assert expected_url in organizer_call[1]
    assert "Organizer:" in organizer_call[1]
    
    # Check if others received standard message
    p2_call = next((c for c in calls if c[0] == "+1002"), None)
    assert p2_call is not None
    assert "MATCH CONFIRMED" in p2_call[1]
    assert "Organizer:" not in p2_call[1]
    
    print("Test Match Confirmation Booking Passed!")

if __name__ == "__main__":
    test_match_confirmation_initiator()
