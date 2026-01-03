import sys
import os
from unittest.mock import MagicMock

# Mock Twilio and Redis
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["twilio.base"] = MagicMock()
sys.modules["twilio.base.exceptions"] = MagicMock()
sys.modules["redis"] = MagicMock()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock supabase
mock_supabase = MagicMock()
sys.modules["database"] = MagicMock()
import database
database.supabase = mock_supabase

# Mock twilio_client
mock_twilio_client = MagicMock()
sys.modules["twilio_client"] = mock_twilio_client

from handlers.result_handler import handle_result_report

def test_resolve_name_logic():
    print("Testing resolve_name logic via handle_result_report...")
    
    # Setup mock match and players
    player_id = "p_adam"
    from_number = "+1234567890"
    
    match = {
        "match_id": "m123",
        "team_1_players": ["p_adam", "p_augustin"],
        "team_2_players": ["p_alexander", "p_alexander2"],
        "status": "confirmed"
    }
    
    players_data = [
        {"player_id": "p_adam", "name": "Adam Rogers"},
        {"player_id": "p_augustin", "name": "Augustin"},
        {"player_id": "p_alexander", "name": "Alexander"},
        {"player_id": "p_alexander2", "name": "Alexander Graham"}
    ]
    
    # Mock supabase responses
    mock_supabase.table().select().or_().eq().order().limit().execute.return_value.data = [match]
    
    # We need to mock the second call inside handle_result_report which is players fetch
    # handle_result_report has multiple calls to supabase. 
    # Let's mock side_effect for execute
    
    def side_effect():
        # This is a bit complex to mock execute().data directly with side_effect
        # Better to mock the table() calls
        pass

    # Simplified mock approach:
    # 1. Match fetch
    mock_supabase.table("matches").select().or_().eq().order().limit().execute.return_value.data = [match]
    # 2. Players fetch
    mock_supabase.table("players").select().in_().execute.return_value.data = players_data
    # 3. Update call
    mock_supabase.table("matches").update().eq().execute.return_value.data = [{}]
    
    # Mock update_match_elo
    sys.modules["logic.elo_service"] = MagicMock()
    import logic.elo_service
    logic.elo_service.update_match_elo.return_value = True

    # Case 1: "Adam and Augustin beat Alex and Alexander Graham"
    print("\nCase 1: Adam and Augustin vs Alex and Alexander Graham (Ambiguous)")
    entities = {
        "score": "6-4 6-2",
        "winner": "we",
        "team_a": ["Adam", "Augustin"],
        "team_b": ["Alex", "Alexander Graham"]
    }
    
    player_profile = {"player_id": "p_adam", "name": "Adam Rogers"}
    
    handle_result_report(from_number, player_profile, entities)
    
    # Verify that send_sms was called with clarification (because Alex is ambiguous with Alexander and Alexander Graham)
    assert mock_twilio_client.send_sms.called
    clarify_msg = mock_twilio_client.send_sms.call_args[0][1]
    print(f"Clarification sent: {clarify_msg[:50]}...")
    assert "trouble identifying the teams" in clarify_msg
    assert "Team A as (Adam Rogers, Augustin)" in clarify_msg
    
    mock_twilio_client.send_sms.reset_mock()

    # Case 2: "Adam and Augustin beat Alexander and Alexander Graham" (Not ambiguous)
    print("\nCase 2: Adam and Augustin vs Alexander and Alexander Graham (Unique)")
    entities = {
        "score": "6-4 6-2",
        "winner": "we",
        "team_a": ["Adam", "Augustin"],
        "team_b": ["Alexander", "Alexander Graham"]
    }
    
    handle_result_report(from_number, player_profile, entities)
    
    # Verify update call
    assert mock_supabase.table("matches").update.called
    update_call = mock_supabase.table("matches").update.call_args[0][0]
    print(f"Updated Team 1: {update_call['team_1_players']}")
    print(f"Updated Team 2: {update_call['team_2_players']}")
    
    assert set(update_call['team_1_players']) == {"p_adam", "p_augustin"}
    assert set(update_call['team_2_players']) == {"p_alexander", "p_alexander2"}
    
    print("\nVerification complete - All tests passed.")

if __name__ == "__main__":
    test_resolve_name_logic()
