import sys
import os
from unittest.mock import MagicMock
import asyncio

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock supabase
mock_supabase = MagicMock()
sys.modules["database"] = MagicMock()
import database
database.supabase = mock_supabase

from api_routes import bulk_delete_matches, BulkMatchDeleteRequest

async def test_bulk_delete_logic():
    print("Testing bulk_delete_matches logic...")
    
    match_ids = ["m1", "m2"]
    request = BulkMatchDeleteRequest(match_ids=match_ids)
    
    # Setup mock chain
    # mock_supabase.table().delete().in_().execute.return_value.data
    mock_execute = MagicMock()
    mock_execute.data = [{"match_id": "m1"}, {"match_id": "m2"}]
    
    # Each call in the chain returns the next mock or the final execute mock
    mock_supabase.table.return_value.delete.return_value.in_.return_value.execute.return_value = mock_execute
    # For .eq() used in other deletions if any
    mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = mock_execute
    
    result = await bulk_delete_matches(request)
    
    print(f"Result: {result}")
    
    # Verify matches deletion specifically
    assert result["deleted_count"] == 2
    
    # Verify table calls
    table_calls = [call.args[0] for call in mock_supabase.table.call_args_list]
    print(f"Tables targeted: {table_calls}")
    
    expected_tables = ["match_feedback", "match_invites", "feedback_requests", "player_rating_history", "match_votes", "matches"]
    for t in expected_tables:
        assert t in table_calls, f"Table {t} was not targeted for deletion"

    print("\nVerification complete - Bulk delete logic executed correctly.")

if __name__ == "__main__":
    asyncio.run(test_bulk_delete_logic())
