from unittest.mock import MagicMock, patch
import sys
import os

# Mock modules before importing twilio_manager
mock_twilio = MagicMock()
sys.modules["twilio"] = mock_twilio
sys.modules["twilio.rest"] = MagicMock()
sys.modules["supabase"] = MagicMock()

# Add parent directory to path to find components
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import twilio_manager

# Removed pytest fixtures to use simple function calls in main

def test_search_available_numbers(mock_twilio):
    # Mock the return value of available_phone_numbers('US').local.list
    mock_number = MagicMock()
    mock_number.phone_number = "+13055551212"
    mock_number.friendly_name = "(305) 555-1212"
    mock_twilio.available_phone_numbers.return_value.local.list.return_value = [mock_number]
    
    with patch("twilio_manager.account_sid", "test_sid"), \
         patch("twilio_manager.auth_token", "test_token"):
        numbers = twilio_manager.search_available_numbers("305")
    
    assert len(numbers) == 1
    assert numbers[0]["phone_number"] == "+13055551212"
    mock_twilio.available_phone_numbers.assert_called_with('US')

def test_provision_club_number(mock_twilio, mock_supabase):
    mock_purchased = MagicMock()
    mock_purchased.sid = "PN123"
    mock_twilio.incoming_phone_numbers.create.return_value = mock_purchased
    
    with patch("twilio_manager.account_sid", "test_sid"), \
         patch("twilio_manager.auth_token", "test_token"):
        success, result = twilio_manager.provision_club_number("club_123", "+13055551212")
    
    assert success is True
    assert result == "+13055551212"
    
    # Verify DB update
    mock_supabase.table.assert_called_with("clubs")
    mock_supabase.table().update.assert_called_with({
        "phone_number": "+13055551212",
        "twilio_sid": "PN123"
    })

def test_release_club_number(mock_twilio, mock_supabase):
    # Mock the DB fetch of sid
    mock_res = MagicMock()
    mock_res.data = {"twilio_sid": "PN123"}
    mock_supabase.table().select().eq().maybe_single().execute.return_value = mock_res
    
    with patch("twilio_manager.account_sid", "test_sid"), \
         patch("twilio_manager.auth_token", "test_token"):
        success, result = twilio_manager.release_club_number("club_123")
    
    assert success is True
    # Verify Twilio deletion
    mock_twilio.incoming_phone_numbers.assert_called_with("PN123")
    mock_twilio.incoming_phone_numbers().delete.assert_called()
    
    # Verify DB clear
    mock_supabase.table().update.assert_called_with({
        "phone_number": None,
        "twilio_sid": None
    })

if __name__ == "__main__":
    import sys
    # Simple runner
    try:
        print("Running tests...")
        
        # Mocking for standalone run (same as fixtures)
        with patch("twilio_manager.supabase") as m_supabase, \
             patch("twilio_manager.Client") as m_client:
            
            client_instance = MagicMock()
            m_client.return_value = client_instance
            
            print("Running test_search_available_numbers...")
            test_search_available_numbers(client_instance)
            
            print("Running test_provision_club_number...")
            test_provision_club_number(client_instance, m_supabase)
            
            print("Running test_release_club_number...")
            test_release_club_number(client_instance, m_supabase)
            
            print("\nALL TESTS PASSED!")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
