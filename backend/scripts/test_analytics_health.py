
import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock supabase before importing routes
with patch('database.supabase') as mock_supabase:
    from analytics_routes import get_club_health

class TestAnalyticsHealth(unittest.IsolatedAsyncioTestCase):
    
    @patch('analytics_routes.supabase')
    async def test_skill_distribution_bucketing(self, mock_supabase):
        # Setup mock data with highly granular levels
        mock_players = [
            {"player_id": "1", "declared_skill_level": 3.25, "pro_verified": True},
            {"player_id": "2", "declared_skill_level": 3.84, "pro_verified": False}, # Should snap to 3.75 or 4.0? 3.84 * 4 = 15.36 -> 15 -> 3.75
            {"player_id": "3", "declared_skill_level": 3.91, "pro_verified": False}, # 3.91 * 4 = 15.64 -> 16 -> 4.0
            {"player_id": "4", "declared_skill_level": 2.1, "pro_verified": False}, # 2.1 * 4 = 8.4 -> 8 -> 2.0
            {"player_id": "5", "declared_skill_level": 5.95, "pro_verified": True}, # 5.95 * 4 = 23.8 -> 24 -> 6.0
        ]
        
        mock_execute = MagicMock()
        mock_execute.data = mock_players
        mock_supabase.table().select().eq().eq().execute.return_value = mock_execute
        
        result = await get_club_health("test-club")
        
        dist = result["skill_distribution"]
        
        # Verify 0.25 increments exist (pre-populated)
        # Verify range keys exist
        expected_ranges = [
            "2.0-2.5", "2.5-3.0", "3.0-3.5", "3.5-4.0", 
            "4.0-4.5", "4.5-5.0", "5.0-5.5", "> 5.5"
        ]
        for rk in expected_ranges:
            self.assertIn(rk, dist)
        
        # Verify counts
        # 3.25 -> 3.0-3.5
        # 3.84 -> 3.5-4.0
        # 3.91 -> 3.5-4.0
        # 2.1  -> 2.0-2.5
        # 5.95 -> > 5.5
        self.assertEqual(dist["3.0-3.5"], 1)
        self.assertEqual(dist["3.5-4.0"], 2)
        self.assertEqual(dist["2.0-2.5"], 1)
        self.assertEqual(dist["> 5.5"], 1)
        
        # Verify total players
        self.assertEqual(result["total_players"], 5)
        self.assertEqual(result["verified_pct"], 40.0) # 2/5

if __name__ == "__main__":
    unittest.main()
