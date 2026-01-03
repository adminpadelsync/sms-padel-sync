import sys
import os
import json
from unittest.mock import MagicMock, patch
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
sys.path.append(os.path.join(os.getcwd(), 'backend/handlers'))

# Mock external dependencies before they are imported by match_handler
sys.modules['database'] = MagicMock()
sys.modules['twilio_client'] = MagicMock()
sys.modules['redis_client'] = MagicMock()
sys.modules['error_logger'] = MagicMock()

import sms_constants as msg
from handlers.match_handler import handle_court_booking_sms, notify_players_of_booking

@patch('handlers.match_handler.supabase')
@patch('handlers.match_handler.send_sms')
def test_sms_booking_trigger(mock_send_sms, mock_supabase):
    player_id = "p1"
    match_id = "match123"
    club_id = "club123"
    
    mock_player = {"player_id": player_id, "club_id": club_id}
    mock_match = {
        "match_id": match_id,
        "club_id": club_id,
        "status": "confirmed",
        "team_1_players": [player_id, "p2"],
        "team_2_players": ["p3", "p4"],
        "scheduled_time": "2023-12-25T10:00:00Z",
        "court_booked": False
    }
    
    # Mock chain for handle_court_booking_sms
    # 1. Match fetch search
    # 2. Update match
    # 3. notify_players_of_booking -> fetch match
    # 4. fetch club
    # 5. fetch player phones (4 calls)
    
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.or_.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[mock_match])
    
    # notify_players_of_booking calls
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        MagicMock(data=[mock_match]), # notify_players fetch match
        MagicMock(data=[{"name": "Test Club"}]), # notify_players fetch club
        MagicMock(data=[{"phone_number": "+1001"}]), # p1
        MagicMock(data=[{"phone_number": "+1002"}]), # p2
        MagicMock(data=[{"phone_number": "+1003"}]), # p3
        MagicMock(data=[{"phone_number": "+1004"}]), # p4
    ]
    
    entities = {"court_text": "Court 6"}
    handle_court_booking_sms("+1001", mock_player, entities)
    
    # Verify update called
    mock_supabase.table.return_value.update.assert_called()
    update_args = mock_supabase.table.return_value.update.call_args[0][0]
    assert update_args["court_booked"] is True
    assert update_args["booked_court_text"] == "Court 6"
    
    # Verify 4 SMS sent
    assert mock_send_sms.call_count == 4
    for call in mock_send_sms.call_args_list:
        assert "Court 6" in call[0][1]
        assert "Test Club" in call[0][1]
        # Verify club_id is passed as keyword argument
        assert call[1]["club_id"] == club_id

    print("✅ test_sms_booking_trigger passed!")

if __name__ == "__main__":
    test_sms_booking_trigger()
