import unittest
import sys
import os
import requests
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.path.abspath('backend'))

# Mock dependencies
sys.modules["supabase"] = MagicMock()
sys.modules["dotenv"] = MagicMock()
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.base"] = MagicMock()
sys.modules["twilio.base.exceptions"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["redis"] = MagicMock()
sys.modules["pytz"] = MagicMock()

from logic.reasoner import reason_message

class TestLoggingFix(unittest.TestCase):
    
    @patch('logic.reasoner.log_sms_error')
    @patch('requests.post')
    @patch('os.getenv')
    def test_timeout_logs_error(self, mock_getenv, mock_post, mock_log_error):
        # Mock API Key
        mock_getenv.return_value = "dummy_key"
        
        # Mock Timeout
        mock_post.side_effect = requests.exceptions.Timeout("Mocked Timeout")
        
        # Call reason_message
        result = reason_message("Test message")
        
        # We expect log_sms_error to be called 4 times (1 initial + 3 retries)
        # CURRENT BEHAVIOR: 0 times (failure)
        # DESIRED BEHAVIOR: > 0 times
        print(f"Log Error Call Count: {mock_log_error.call_count}")
        self.assertGreater(mock_log_error.call_count, 0, "log_sms_error should be called on timeout")

if __name__ == '__main__':
    unittest.main()
