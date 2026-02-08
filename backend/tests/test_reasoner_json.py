import unittest
import sys
import os
import json
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
sys.modules["requests"] = MagicMock()

from logic.reasoner import extract_json_from_text, extract_detailed_match_results

class TestReasonerJSON(unittest.TestCase):
    
    def test_clean_json(self):
        text = '{"key": "value"}'
        data = extract_json_from_text(text)
        self.assertEqual(data, {"key": "value"})

    def test_markdown_json(self):
        text = '```json\n{"key": "value"}\n```'
        data = extract_json_from_text(text)
        self.assertEqual(data, {"key": "value"})

    def test_markdown_no_lang(self):
        text = '```\n{"key": "value"}\n```'
        data = extract_json_from_text(text)
        self.assertEqual(data, {"key": "value"})

    def test_text_surrounded_json(self):
        text = 'Here is the json: {"key": "value"} thanks'
        data = extract_json_from_text(text)
        self.assertEqual(data, {"key": "value"})

    def test_list_json(self):
        text = '[{"key": "value"}]'
        data = extract_json_from_text(text)
        self.assertEqual(data, [{"key": "value"}])

    def test_malformed_fallback(self):
        # Missing closing brace but maybe we can't rescue that. 
        # But let's test that unexpected text before/after is handled
        text = 'Sure! ```json [ {"a": 1} ] ``` '
        data = extract_json_from_text(text)
        self.assertEqual(data, [{"a": 1}])
        
    @patch('os.getenv', return_value='dummy_key')
    @patch('logic.reasoner.call_gemini_api')
    def test_extract_detailed_results_flow(self, mock_api, mock_getenv):
        # valid markdown response
        mock_api.return_value = '```json\n[{"winner": "team_1"}]\n```'
        
        players = [{"player_id": "p1", "name": "P1"}]
        results = extract_detailed_match_results("msg", players, "p1")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["winner"], "team_1")

    @patch('os.getenv', return_value='dummy_key')
    @patch('logic.reasoner.call_gemini_api')
    def test_extract_detailed_results_error(self, mock_api, mock_getenv):
        # Invalid json
        mock_api.return_value = 'I cannot do that'
        
        players = [{"player_id": "p1", "name": "P1"}]
        results = extract_detailed_match_results("msg", players, "p1")
        self.assertEqual(results, [])

if __name__ == '__main__':
    unittest.main()
