import sys
import os
from unittest.mock import MagicMock

# Add backend to path FIRST
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock Twilio and Redis
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["twilio.base"] = MagicMock()
sys.modules["twilio.base.exceptions"] = MagicMock()
sys.modules["redis"] = MagicMock()

# Mock database
mock_supabase = MagicMock()
sys.modules["database"] = MagicMock()
import database
database.supabase = mock_supabase

# Mock twilio_client
mock_twilio_client = MagicMock()
sys.modules["twilio_client"] = mock_twilio_client

# Mock logic dependencies
mock_reasoner = MagicMock()
sys.modules["logic.reasoner"] = mock_reasoner
mock_reasoner.resolve_names_with_ai.return_value = {"player_id": None, "confidence": 0.0, "reasoning": "Standard mock"}

mock_elo = MagicMock()
sys.modules["logic.elo_service"] = mock_elo
mock_elo.update_match_elo.return_value = True

# Now we can import the handler
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
    
    # 1. Match fetch
    mock_supabase.table("matches").select().or_().eq().order().limit().execute.return_value.data = [match]
    # 2. Players fetch
    mock_supabase.table("players").select().in_().execute.return_value.data = players_data
    # 3. Update call
    mock_supabase.table("matches").update().eq().execute.return_value.data = [{}]
    
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
    assert "trouble identifying some of the names" in clarify_msg
    assert "Team 1: Adam Rogers, Augustin" in clarify_msg
    
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
    
    mock_supabase.table("matches").update.reset_mock()
    mock_twilio_client.send_sms.reset_mock()

    # Case 3: "Adam and Tony beat Alex and Agustin" (Nickname resolution)
    # Tony -> Anthony
    # Agustin -> Augustin
    # Alex -> Alexander
    print("\nCase 3: Adam and Tony vs Alex and Agustin (Nicknames)")
    
    # Setup mock behavior for AI resolution
    def mock_resolve_ai(name, players):
        n = name.lower()
        if n == "tony":
            return {"player_id": "p_anthony", "confidence": 0.9, "reasoning": "Tony is Anthony"}
        if n == "agustin":
            return {"player_id": "p_augustin", "confidence": 0.9, "reasoning": "Agustin is Augustin"}
        if n == "alex":
            # For Alex, we'll return alexander explicitly as a likely candidate
            return {"player_id": "p_alexander", "confidence": 0.9, "reasoning": "Alex is Alexander"}
        return {"player_id": None, "confidence": 0.0, "reasoning": "NotFound"}
    
    mock_reasoner.resolve_names_with_ai.side_effect = mock_resolve_ai
    
    players_with_tony = [
        {"player_id": "p_adam", "name": "Adam Rogers"},
        {"player_id": "p_augustin", "name": "Augustin"},
        {"player_id": "p_alexander", "name": "Alexander"},
        {"player_id": "p_anthony", "name": "Anthony"}
    ]
    match_with_tony = {
        "match_id": "m124",
        "team_1_players": ["p_adam", "p_anthony"],
        "team_2_players": ["p_alexander", "p_augustin"],
        "status": "confirmed"
    }
    
    mock_supabase.table("matches").select().or_().eq().order().limit().execute.return_value.data = [match_with_tony]
    mock_supabase.table("players").select().in_().execute.return_value.data = players_with_tony
    
    entities_3 = {
        "score": "6-4 6-2",
        "winner": "we",
        "team_a": ["Adam", "Tony"],
        "team_b": ["Alex", "Agustin"]
    }
    
    handle_result_report(from_number, player_profile, entities_3)
    
    assert mock_supabase.table("matches").update.called
    update_call_3 = mock_supabase.table("matches").update.call_args[0][0]
    print(f"Updated Team 1: {update_call_3['team_1_players']}")
    print(f"Updated Team 2: {update_call_3['team_2_players']}")
    
    assert set(update_call_3['team_1_players']) == {"p_adam", "p_anthony"}
    assert set(update_call_3['team_2_players']) == {"p_alexander", "p_augustin"}

    print("\nVerification complete - All tests passed.")

if __name__ == "__main__":
    test_resolve_name_logic()
