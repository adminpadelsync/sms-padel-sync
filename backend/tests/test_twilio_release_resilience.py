import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock dependencies before importing twilio_manager
mock_supabase = MagicMock()
sys.modules['database'] = MagicMock()
sys.modules['database'].supabase = mock_supabase

# Mock twilio
mock_twilio = MagicMock()
sys.modules['twilio'] = mock_twilio
sys.modules['twilio.rest'] = MagicMock()

import twilio_manager

class TestTwilioReleaseResilience(unittest.TestCase):
    @patch('twilio_manager.get_twilio_client')
    def test_release_club_number_204_resilience(self, mock_get_client):
        # Mock Twilio client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # 1. Test Select 204 Error (as exception with dict string)
        mock_execute = MagicMock()
        # Mock the exception string to match what we saw in the screenshot
        err_dict = {'message': 'Missing response', 'code': '204', 'details': 'Postgrest hit 204'}
        mock_execute.execute.side_effect = Exception(str(err_dict))
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_execute
        
        success, msg = twilio_manager.release_club_number("test-club-id")
        self.assertFalse(success)
        self.assertIn("204", msg)
        
        # 2. Test Select 204 Error (as response - though less likely in older postgrest-py)
        # If it returns a response object with 204 data
        mock_execute.execute.side_effect = None
        mock_execute.execute.return_value = MagicMock(data=None, status_code=204)
        
        success, msg = twilio_manager.release_club_number("test-club-id")
        self.assertFalse(success)
        # It should hit the "No active number found for this club" check since data is None

        # 3. Test Update 204 Error (Success path)
        # Mock SID found
        mock_execute.execute.return_value = MagicMock(data={"twilio_sid": "SK123"})
        
        # Mock Update execute to throw 204 string
        mock_update_execute = MagicMock()
        mock_update_execute.execute.side_effect = Exception(str({'code': '204', 'message': 'Missing response'}))
        
        # Setup the chain: table().update().eq() -> mock_update_execute
        # Note: table().select().eq().maybe_single() is already setup above
        # We need to distinguish between select and update
        def table_side_effect(name):
            if name == "clubs":
                return mock_supabase_table
            return MagicMock()
            
        mock_supabase_table = MagicMock()
        mock_supabase.table.side_effect = table_side_effect
        
        mock_supabase_table.select.return_value.eq.return_value.maybe_single.return_value = mock_execute
        mock_supabase_table.update.return_value.eq.return_value = mock_update_execute
        
        success, msg = twilio_manager.release_club_number("test-club-id")
        self.assertTrue(success)
        self.assertEqual(msg, "Number release handled")
        
        # Verify Twilio delete was called
        mock_client.incoming_phone_numbers.return_value.delete.assert_called_once()

    @patch('twilio_manager.get_twilio_client')
    def test_provision_club_number_friendly_name(self, mock_get_client):
        # Mock Twilio client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mock Supabase fetch for club name
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data={"name": "Test Club"})
        
        # Mock purchased number
        mock_purchased = MagicMock(sid="PN123")
        mock_client.incoming_phone_numbers.create.return_value = mock_purchased
        
        success, result = twilio_manager.provision_club_number("club-123", "+15615893922")
        self.assertTrue(success)
        
        # Verify friendly name format
        expected_name = "(561) 589-3922 (Test Club)"
        mock_client.incoming_phone_numbers.create.assert_called_once()
        args, kwargs = mock_client.incoming_phone_numbers.create.call_args
        self.assertEqual(kwargs["friendly_name"], expected_name)

    @patch('twilio_manager.get_twilio_client')
    def test_provision_group_number_friendly_name(self, mock_get_client):
        # Mock Twilio client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        
        # Mock Supabase fetch for group and club name
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data={
            "name": "Friday Fun",
            "clubs": {"name": "Test Club"}
        })
        
        # Mock purchased number
        mock_purchased = MagicMock(sid="PN456")
        mock_client.incoming_phone_numbers.create.return_value = mock_purchased
        
        success, result = twilio_manager.provision_group_number("group-456", "+15615893922")
        self.assertTrue(success)
        
        # Verify friendly name format
        expected_name = "(561) 589-3922 (Test Club - Friday Fun)"
        mock_client.incoming_phone_numbers.create.assert_called_once()
        args, kwargs = mock_client.incoming_phone_numbers.create.call_args
        self.assertEqual(kwargs["friendly_name"], expected_name)

if __name__ == '__main__':
    unittest.main()
