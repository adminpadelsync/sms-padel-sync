import os
import sys
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from twilio_client import send_sms
from database import supabase

def test_per_club_settings():
    print("--- Testing Per-Club SMS Settings ---")
    
    # Use a dummy club ID for testing
    # In a real environment, we'd use a test club in the DB
    # For this test, we'll mock the supabase response
    
    test_club_id = "00000000-0000-0000-0000-000000000000"
    test_phone = "+15551112222"
    
    with patch("database.supabase.table") as mock_table:
        # 1. Test: Club in TEST MODE
        mock_table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "settings": {
                "sms_test_mode": True,
                "sms_whitelist": ""
            }
        }
        
        with patch("twilio_client.store_in_outbox") as mock_outbox:
            mock_outbox.return_value = True
            print("\nScenario 1: Club in TEST MODE")
            result = send_sms(test_phone, "Test message", club_id=test_club_id)
            print(f"Result: {result}")
            mock_outbox.assert_called_once()
            print("SUCCESS: Message routed to outbox in test mode.")

        # 2. Test: Club in LIVE MODE with WHITELIST (Number NOT whitelisted)
        mock_table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "settings": {
                "sms_test_mode": False,
                "sms_whitelist": "+15550000000, +15559999999"
            }
        }
        
        with patch("twilio_client.store_in_outbox") as mock_outbox:
            mock_outbox.return_value = True
            print("\nScenario 2: Club in LIVE MODE, NOT whitelisted")
            result = send_sms(test_phone, "Test message", club_id=test_club_id)
            print(f"Result: {result}")
            mock_outbox.assert_called_once()
            print("SUCCESS: Message routed to outbox because number is not in whitelist.")

        # 3. Test: Club in LIVE MODE with WHITELIST (Number IS whitelisted)
        mock_table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "settings": {
                "sms_test_mode": False,
                "sms_whitelist": f"+15550000000, {test_phone}"
            }
        }
        
        # Mock Twilio client to avoid real API calls
        with patch("twilio_client.get_twilio_client") as mock_twilio:
            mock_client = MagicMock()
            mock_twilio.return_value = mock_client
            print("\nScenario 3: Club in LIVE MODE, IS whitelisted")
            result = send_sms(test_phone, "Test message", club_id=test_club_id)
            print(f"Result: {result}")
            mock_client.messages.create.assert_called_once()
            print("SUCCESS: Message sent to Twilio because number is in whitelist.")

        # 4. Test: Backward compatibility (No club_id, use global env)
        print("\nScenario 4: No club_id provided (Global Fallback)")
        # We need to temporarily set global test_mode to false and whitelist to empty for this
        with patch("twilio_client.test_mode", False), \
             patch("twilio_client.sms_whitelist", set()), \
             patch("twilio_client.get_twilio_client") as mock_twilio_global:
            
            mock_client_global = MagicMock()
            mock_twilio_global.return_value = mock_client_global
            result = send_sms(test_phone, "Global message")
            print(f"Result: {result}")
            mock_client_global.messages.create.assert_called_once()
            print("SUCCESS: Global fallback works.")

if __name__ == "__main__":
    test_per_club_settings()
