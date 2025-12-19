import sys
import os
from datetime import datetime, timedelta
import pytz
from unittest.mock import MagicMock, patch

# Add current directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Mock database before imports if necessary, but we can patch logic_utils
from logic_utils import get_club_timezone, is_quiet_hours
from handlers.date_parser import parse_natural_date

def test_timezone_retrieval():
    print("\n--- Testing Timezone Retrieval ---")
    with patch('database.supabase.table') as mock_table:
        # Case 1: Timezone exists
        mock_table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{'timezone': 'America/Los_Angeles'}]
        tz = get_club_timezone('club-123')
        print(f"Timezone for club-123 (LA): {tz}")
        assert tz == 'America/Los_Angeles'

        # Case 2: Timezone field missing (simulating column not added yet)
        mock_table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{}]
        tz = get_club_timezone('club-456')
        print(f"Timezone for club-456 (Missing): {tz}")
        assert tz == 'America/New_York'

def test_quiet_hours_logic():
    print("\n--- Testing Quiet Hours Logic ---")
    with patch('logic_utils.get_club_settings') as mock_settings, \
         patch('logic_utils.get_club_timezone') as mock_tz:
        
        mock_settings.return_value = {'quiet_hours_start': 21, 'quiet_hours_end': 8}
        
        # Scenario 1: It's 10 PM in LA, but 1 AM in NY
        # If club is in LA, it should be quiet.
        mock_tz.return_value = 'America/Los_Angeles'
        
        # Fix the "now" for test stability
        la_tz = pytz.timezone('America/Los_Angeles')
        target_time = la_tz.localize(datetime(2025, 1, 1, 22, 0, 0)) # 10 PM LA
        
        with patch('logic_utils.datetime') as mock_datetime:
            mock_datetime.now.return_value = target_time
            mock_datetime.fromisoformat = datetime.fromisoformat
            
            is_quiet = is_quiet_hours('club-la')
            print(f"Is quiet at 10 PM LA (LA club)? {is_quiet}")
            assert is_quiet is True

        # Scenario 2: It's 7 AM in LA (10 AM NY)
        # LA club should be quiet (before 8 AM).
        target_time_2 = la_tz.localize(datetime(2025, 1, 1, 7, 0, 0))
        with patch('logic_utils.datetime') as mock_datetime:
            mock_datetime.now.return_value = target_time_2
            mock_datetime.fromisoformat = datetime.fromisoformat
            is_quiet = is_quiet_hours('club-la')
            print(f"Is quiet at 7 AM LA (LA club)? {is_quiet}")
            assert is_quiet is True

def test_date_parsing_with_timezone():
    print("\n--- Testing Date Parsing with Timezone ---")
    # "tomorrow 6pm" parsed in LA should be different from NY if it's near midnight
    # But more simply, check if it respects the timezone argument.
    
    # If it's 11 PM Dec 1st in LA, "tomorrow" is Dec 2nd.
    # At that same moment, it's 2 AM Dec 2nd in NY, "tomorrow" is Dec 3rd.
    
    la_tz = pytz.timezone('America/Los_Angeles')
    ny_tz = pytz.timezone('America/New_York')
    
    # Moment: 2025-01-01 23:00 LA (which is 2025-01-02 02:00 NY)
    mock_now_la = la_tz.localize(datetime(2025, 1, 1, 23, 0, 0))
    mock_now_ny = ny_tz.localize(datetime(2025, 1, 2, 2, 0, 0))
    
    # We need to patch datetime.now in date_parser._manual_regex_fallback
    with patch('handlers.date_parser.datetime') as mock_dt:
        mock_dt.now.side_effect = lambda tz: mock_now_la.astimezone(tz)
        mock_dt.fromisoformat = datetime.fromisoformat
        mock_dt.strptime = datetime.strptime
        
        # Parse "tomorrow 10am" for LA
        parsed_la, human_la, iso_la = parse_natural_date("tomorrow 10am", timezone='America/Los_Angeles')
        print(f"LA 'tomorrow 10am' (from 11pm Jan 1): {human_la}")
        # should be Jan 2nd
        assert "Jan 02" in human_la

        # Parse "tomorrow 10am" for NY (at same moment)
        parsed_ny, human_ny, iso_ny = parse_natural_date("tomorrow 10am", timezone='America/New_York')
        print(f"NY 'tomorrow 10am' (from 2am Jan 2): {human_ny}")
        # should be Jan 3rd
        assert "Jan 03" in human_ny

if __name__ == "__main__":
    try:
        test_timezone_retrieval()
        test_quiet_hours_logic()
        test_date_parsing_with_timezone()
        print("\n✅ All unit tests passed!")
    except AssertionError as e:
        print(f"\n❌ Test failed!")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
