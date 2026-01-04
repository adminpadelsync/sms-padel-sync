import sys
import os
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.append(os.getcwd())

# Mock dependencies
sys.modules["database"] = MagicMock()
sys.modules["twilio_client"] = MagicMock()
sys.modules["redis_client"] = MagicMock()
sys.modules["handlers.date_parser"] = MagicMock()
sys.modules["error_logger"] = MagicMock()

# Mock get_club_timezone to return EST
import logic_utils
logic_utils.get_club_timezone = MagicMock(return_value="America/New_York")

import handlers.match_handler as match_handler
import sms_constants as msg

def test_none_bug_fix():
    print("Testing 'None!' bug fix in handle_group_selection...")
    
    from_number = "+1234567890"
    player = {"player_id": "p123", "club_id": "c456", "name": "Adam"}
    state_data = {
        "scheduled_time_iso": "2026-01-04T23:00:00Z",
        "scheduled_time_human": "Sun, Jan 4th @ 6pm", # This was the old one
        "group_options": {
            "2": {"group_id": "g789", "group_name": "Intermediate Players"}
        }
    }
    
    # Mock _create_match to capture call arguments
    with patch("handlers.match_handler._create_match") as mock_create:
        with patch("handlers.match_handler.send_sms") as mock_send_sms:
            # Simulate user replying "2" for the group
            match_handler.handle_group_selection(from_number, "2", player, state_data)
            
            # Verify _create_match was called
            assert mock_create.called
            args, kwargs = mock_create.call_args
            
            # Check the friendly_time argument (10th positional or kwargs)
            # _create_match(from_number, iso, human, player, level_min, level_max, gender, target_group_id, skip_filters, group_name, friendly_time)
            friendly_time = kwargs.get("friendly_time")
            if friendly_time is None and len(args) > 10:
                friendly_time = args[10]
                
            print(f"Captured friendly_time: {friendly_time}")
            assert friendly_time is not None
            assert "6pm" in friendly_time
            assert "Sun, Jan 4th" in friendly_time
            assert friendly_time != "None!"

    print("\nVerification complete - 'None!' bug is fixed.")

if __name__ == "__main__":
    test_none_bug_fix()
