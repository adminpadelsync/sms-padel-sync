# import pytest
from database import supabase

def test_save_assessment_result():
    """Test saving an assessment result to the database."""
    test_data = {
        "player_name": "Test User",
        "responses": {"q1": 1, "q2": 2},
        "rating": 3.5,
        "breakdown": {"percentage": 50, "rawRating": 3.5, "ceiling": 6.0, "wasCapped": False}
    }
    
    # 1. Insert via API (simulated or direct supabase)
    # Since we can't easily run the FastAPI server and call it from here, 
    # we'll test the database logic directly or assume the route is simple enough.
    # However, let's try to verify the table exists and accepts data.
    
    try:
        result = supabase.table("assessment_results").insert(test_data).execute()
        assert result.data is not None
        assert len(result.data) > 0
        assert result.data[0]["player_name"] == "Test User"
        assert result.data[0]["rating"] == 3.5
        
        # Cleanup
        inserted_id = result.data[0]["id"]
        supabase.table("assessment_results").delete().eq("id", inserted_id).execute()
        
    except Exception as e:
        print(f"Failed to save assessment result: {e}")
        exit(1)

if __name__ == "__main__":
    test_save_assessment_result()
