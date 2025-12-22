import sys
import os
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import sms_constants as msg
from sms_handler import handle_incoming_sms

@patch('sms_handler.supabase')
@patch('sms_handler.send_sms')
@patch('sms_handler.set_user_state')
def test_onboarding_welcome(mock_set_state, mock_send_sms, mock_supabase):
    # Setup mock club
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"club_id": "club123", "name": "Test Club", "booking_system": "playbypoint"}
    ]
    
    # Setup mock no player found
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    
    # Setup mock no state found
    with patch('sms_handler.get_user_state', return_value=None):
        handle_incoming_sms("+1234567890", "Hello", to_number="+0987654321")
        
        # Verify MSG_WELCOME_NEW with Play by Point
        expected_msg = msg.MSG_WELCOME_NEW.format(club_name="Test Club", booking_system="Play by Point")
        mock_send_sms.assert_any_call("+1234567890", expected_msg)
        print("Test Onboarding Welcome Passed!")

if __name__ == "__main__":
    test_onboarding_welcome()
