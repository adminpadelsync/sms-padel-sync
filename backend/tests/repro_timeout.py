import sys
import os
import unittest
from unittest.mock import MagicMock, patch
import requests

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

class TestReasonerTimeout(unittest.TestCase):
    
    @patch('requests.post')
    @patch('os.getenv')
    def test_reason_message_timeout(self, mock_getenv, mock_post):
        # Mock API Key
        mock_getenv.return_value = "dummy_key"
        
        # Mock Timeout
        mock_post.side_effect = requests.exceptions.Timeout("Mocked Timeout")
        
        # Call reason_message
        result = reason_message("Test message")
        
        # Verify result
        self.assertEqual(result.intent, "UNKNOWN")
        self.assertEqual(result.reply_text, "I'm sorry, I timed out. Can you try again?")
        self.assertIn("Failed to generate response after retries", result.raw_reply)
        
        # Verify retries (max_retries=3 + 1 initial attempt = 4 calls)
        self.assertEqual(mock_post.call_count, 4)
        
        # Verify that the timeout was indeed 25 seconds
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs['timeout'], 25)

if __name__ == '__main__':
    unittest.main()
