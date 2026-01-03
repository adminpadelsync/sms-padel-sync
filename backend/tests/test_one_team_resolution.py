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

def test_one_team_resolution():
    print("Testing one-team resolution logic via handle_result_report...")
    
    # Setup mock match and players
    player_id = "p_adam"
    from_number = "+1234567890"
    
    match = {
        "match_id": "m123",
        "team_1_players": ["p_adam", "p_mike"],
        "team_2_players": ["p_alex", "p_alex_h"],
        "status": "confirmed"
    }
    
    players_data = [
        {"player_id": "p_adam", "name": "Adam Rogers (googlevoice)"},
        {"player_id": "p_mike", "name": "Mike Smith"},
        {"player_id": "p_alex", "name": "Alexander Jackson 273"},
        {"player_id": "p_alex_h", "name": "Alexander Hernandez 865"}
    ]
    
    # Mock supabase responses
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

    # Case: "Mike and Adam won 6-2 6-3 7-5"
    # Reasoner would typical extract Mike and Adam into team_a
    print("\nCase: Mike and Adam won (Only one team mentioned)")
    entities = {
        "score": "6-2 6-3 7-5",
        "winner": "Mike and Adam",
        "team_a": ["Mike", "Adam"],
        "team_b": []
    }
    
    player_profile = {"player_id": "p_adam", "name": "Adam Rogers (googlevoice)"}
    
    handle_result_report(from_number, player_profile, entities)
    
    # Verify update call
    assert mock_supabase.table("matches").update.called
    update_data = mock_supabase.table("matches").update.call_args[0][0]
    
    print(f"Verified Team 1: {update_data['team_1_players']}")
    print(f"Verified Team 2: {update_data['team_2_players']}")
    print(f"Winner Team Index: {update_data['winner_team']}")
    
    assert set(update_data['team_1_players']) == {"p_adam", "p_mike"}
    assert set(update_data['team_2_players']) == {"p_alex", "p_alex_h"}
    # Since Mike and Adam are in team_a and matched Team 1, and winner="Mike and Adam" (contains Mike/Adam)
    # The winner logic:
    # winner_team = 1 # Default
    # if "b" in winner_str or ...: winner_team = 2
    # elif "a" in winner_str or ...: winner_team = 1
    # "Mike and Adam" won't match "a" or "b" strictly, but let's see current logic:
    # winner_team = 1 (Default)
    
    print("\nTest passed!")

if __name__ == "__main__":
    test_one_team_resolution()
