import unittest
import sys
import os
from unittest.mock import patch

# Add backend to path
sys.path.append(os.path.abspath('backend'))

from llm_config import LLMConfig

class TestLLMConfig(unittest.TestCase):

    @patch('os.getenv')
    def test_default_model(self, mock_getenv):
        # Setup mock to return None (missing env var)
        def side_effect(key, default=None):
            if key == "LLM_MODEL_NAME":
                return default
            return default
        mock_getenv.side_effect = side_effect
        
        self.assertEqual(LLMConfig.get_model_name(), "gemini-flash-latest")

    @patch('os.getenv')
    def test_override_invalid_model(self, mock_getenv):
        # Setup mock to return the known invalid model
        def side_effect(key, default=None):
            if key == "LLM_MODEL_NAME":
                return "gemini-2.5-flash"
            return default
        mock_getenv.side_effect = side_effect
        
        # Should be overridden to 1.5-flash
        self.assertEqual(LLMConfig.get_model_name(), "gemini-1.5-flash")

    @patch('os.getenv')
    def test_valid_custom_model(self, mock_getenv):
        # Setup mock to return a valid custom model
        def side_effect(key, default=None):
            if key == "LLM_MODEL_NAME":
                return "gemini-1.0-pro"
            return default
        mock_getenv.side_effect = side_effect
        
        self.assertEqual(LLMConfig.get_model_name(), "gemini-1.0-pro")

if __name__ == '__main__':
    unittest.main()
