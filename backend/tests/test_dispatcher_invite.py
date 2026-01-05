import sys
import os
from unittest.mock import MagicMock, patch

# Mock modules
sys.modules["pytz"] = MagicMock()
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["redis"] = MagicMock()

# Mock dependencies
sys.modules["twilio_client"] = MagicMock()
sys.modules["redis_client"] = MagicMock()

# Add current directory to path (assuming run from backend/)
sys.path.append(os.getcwd())

from handlers.sms.dispatcher import IntentDispatcher
from logic.reasoner import ReasonerResult

def test_dispatcher_accept_invite():
    dispatcher = IntentDispatcher()
    
    # Mock context resolution
    mock_player = {"player_id": "player-123", "name": "Adam", "club_id": "club-123"}
    mock_invite = {"invite_id": "inv-123", "match_id": "match-123", "status": "sent"}
    
    with patch("handlers.sms.dispatcher.resolve_club_context") as mock_resolve_club, \
         patch("handlers.sms.dispatcher.resolve_player") as mock_resolve_player, \
         patch("handlers.sms.dispatcher.get_user_state") as mock_get_state, \
         patch("handlers.sms.dispatcher.reason_message") as mock_reason, \
         patch("handlers.sms.dispatcher.supabase") as mock_supabase, \
         patch("handlers.sms.dispatcher.handle_invite_response") as mock_handle_invite:
        
        mock_resolve_club.return_value = ("club-123", "South Beach", None, None, "Playbypoint")
        mock_resolve_player.return_value = mock_player
        mock_get_state.return_value = {"state": "IDLE"}
        
        # Mock supabase for pending invites
        mock_supabase.table().select().eq().in_().order().execute.return_value.data = [mock_invite]
        # Mock handle_invite_response (second call in slow path check)
        mock_supabase.table().select().eq().in_().order().execute.side_effect = [
            MagicMock(data=[mock_invite]), # 1. Fetching context for Reasoner
            MagicMock(data=[mock_invite])  # 2. Fetching invitations for Slow Path processing
        ]

        # Reasoner result: ACCEPT_INVITE
        mock_reason.return_value = ReasonerResult(
            intent="ACCEPT_INVITE",
            confidence=0.9,
            entities={},
            reply_text="Great, Adam! I've confirmed your spot."
        )
        
        print("Testing Dispatcher with 'Yes!' message and ACCEPT_INVITE intent...")
        dispatcher.handle_sms("+18881234567", "Yes!", to_number="+18887654321")
        
        # Verify handle_invite_response was called with "yes"
        mock_handle_invite.assert_called_once_with("+18881234567", "yes", mock_player, mock_invite)
        print("✅ SUCCESS: Dispatcher correctly routed ACCEPT_INVITE to handle_invite_response.")

if __name__ == "__main__":
    try:
        test_dispatcher_accept_invite()
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
