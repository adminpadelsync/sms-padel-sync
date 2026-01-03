import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock external dependencies
sys.modules['database'] = MagicMock()
sys.modules['twilio_client'] = MagicMock()
sys.modules['redis_client'] = MagicMock()
sys.modules['error_logger'] = MagicMock()
sys.modules['twilio_manager'] = MagicMock()

# Import after mocks
from api_routes import MatchUpdateRequest, update_match_endpoint
import sms_constants as msg

@patch('api_routes.update_match')
@patch('api_routes.notify_players_of_booking')
async def test_update_match_with_booking_notification(mock_notify, mock_update):
    match_id = "match123"
    
    # Mock update_match to return a match object
    mock_update.return_value = {
        "match_id": match_id,
        "status": "confirmed",
        "court_booked": True,
        "booked_court_text": "Court 7"
    }

    # 1. Test update WITH notification
    request = MatchUpdateRequest(
        court_booked=True,
        booked_court_text="Court 7",
        notify_players=True
    )
    
    result = await update_match_endpoint(match_id, request)
    
    assert result["match"]["court_booked"] is True
    assert result["match"]["booked_court_text"] == "Court 7"
    mock_notify.assert_called_once_with(match_id, "Court 7")
    
    # 2. Test update WITHOUT notification
    mock_notify.reset_mock()
    request_no_notify = MatchUpdateRequest(
        court_booked=True,
        booked_court_text="Court 8",
        notify_players=False
    )
    
    result_no_notify = await update_match_endpoint(match_id, request_no_notify)
    mock_notify.assert_not_called()
    
    print("✅ test_update_match_with_booking_notification passed!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_update_match_with_booking_notification())
