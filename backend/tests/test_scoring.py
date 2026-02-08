import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add backend to path - we need to go up two levels if running from root, or one level if running from backend
# Assuming running from root:
sys.path.append(os.path.abspath('backend'))

# Mock supabase client before importing modules that use it
from unittest.mock import MagicMock
sys.modules["supabase"] = MagicMock()
sys.modules["dotenv"] = MagicMock()
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.base"] = MagicMock()
sys.modules["twilio.base.exceptions"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["redis"] = MagicMock() # redis_client uses redis
sys.modules["pytz"] = MagicMock()
sys.modules["requests"] = MagicMock() # reasoner uses requests
sys.modules["logic_utils"] = MagicMock() # mock utils entirely

# Explicitly import the module to ensure it's registered
try:
    from handlers import result_handler
except ImportError:
    # If that fails, maybe we are inside backend
    sys.path.append(os.path.abspath('.'))
    from handlers import result_handler

class TestScoringUpdates(unittest.TestCase):
    
    @patch('handlers.result_handler.supabase')
    @patch('logic.reasoner.extract_detailed_match_results')
    @patch('handlers.result_handler.update_match_elo')
    @patch('handlers.result_handler.send_sms')
    @patch('logic_utils.get_match_participants')
    def test_draw_result(self, mock_get_parts, mock_send_sms, mock_update_elo, mock_extract, mock_supabase):
        from handlers.result_handler import handle_result_report
        
        # Setup Mocks
        # 1. Mock finding the match
        mock_supabase.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = [{'match_id': 'm1'}]
        # mock match details match_res
        mock_supabase.table.return_value.select.return_value.in_.return_value.order.return_value.limit.return_value.execute.return_value.data = [{
            'match_id': 'm1',
            'scheduled_time': '2023-10-27T10:00:00Z',
            'club_id': 'c1',
            'clubs': {'name': 'Test Club'}
        }]
        
        # 2. Mock Participants
        mock_get_parts.return_value = {
            "all": ["p1", "p2", "p3", "p4"],
            "team_1": ["p1", "p2"],
            "team_2": ["p3", "p4"]
        }
        
        # 3. Mock Reasoner Extraction (DRAW)
        mock_extract.return_value = [{
            "score": "6-4 4-6",
            "winner": "draw",
            "team_1": ["p1", "p2"],
            "team_2": ["p3", "p4"]
        }]
        
        # 4. Mock Player and Entities
        player = {"player_id": "p1", "club_id": "c1"}
        entities = {"_raw_message": "We drew 6-4 4-6"}
        
        # Execute
        handle_result_report("1234567890", player, entities, cid="c1")
        
        # Verify
        # Check that update_match_elo was called with winner_team=0
        mock_update_elo.assert_called_with('m1', 0)
        
        # Check Supabase Update args
        # We need to find the call that updates 'matches'
        # mock_supabase.table("matches").update({...}).eq("match_id", "m1").execute()
        # It's hard to introspect chained calls perfectly on the global mock without setting up side_effects,
        # but we can check if update_match_elo was called correctly as a proxy for success.

    @patch('handlers.result_handler.supabase')
    @patch('logic.reasoner.extract_detailed_match_results')
    @patch('handlers.result_handler.update_match_elo')
    @patch('handlers.result_handler.send_sms')
    @patch('logic_utils.get_match_participants')
    def test_multi_match_swap(self, mock_get_parts, mock_send_sms, mock_update_elo, mock_extract, mock_supabase):
        from handlers.result_handler import handle_result_report
        
        # Setup Mocks
        # Match finding same as above
        mock_supabase.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = [{'match_id': 'm1'}]
        mock_supabase.table.return_value.select.return_value.in_.return_value.order.return_value.limit.return_value.execute.return_value.data = [{
            'match_id': 'm1',
            'scheduled_time': '2023-10-27T10:00:00Z',
            'club_id': 'c1',
            'clubs': {'name': 'Test Club'}
        }]
        
        mock_get_parts.return_value = {
            "all": ["p1", "p2", "p3", "p4"],
            "team_1": ["p1", "p2"],
            "team_2": ["p3", "p4"]
        }
        
        # Mock Reasoner Extraction (2 MATCHES)
        mock_extract.return_value = [
            {
                "score": "6-0",
                "winner": "team_1",
                "team_1": ["p1", "p2"],
                "team_2": ["p3", "p4"]
            },
            {
                "score": "6-1",
                "winner": "team_2",
                "team_1": ["p1", "p3"], # SWAP: p1 with p3
                "team_2": ["p2", "p4"]
            }
        ]
        
        # Mock creating new match for second result
        # Configure the insert(...).execute() chain to return m2
        mock_insert_response = MagicMock()
        mock_insert_response.data = [{'match_id': 'm2'}]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_insert_response

        player = {"player_id": "p1", "club_id": "c1"}
        entities = {"_raw_message": "We won 6-0 then I played with p3 and we lost 6-1"}
        
        # Execute
        handle_result_report("1234567890", player, entities, cid="c1")
        
        # Verify
        # update_match_elo should be called twice: once for m1, once for m2
        self.assertEqual(mock_update_elo.call_count, 2)
        mock_update_elo.assert_any_call('m1', 1) # Result 1: Team 1 won
        mock_update_elo.assert_any_call('m2', 2) # Result 2: Team 2 won (in the context of m2)

if __name__ == '__main__':
    unittest.main()
