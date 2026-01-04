import sys
import os
from unittest.mock import MagicMock
from datetime import datetime, timezone
import pytz

# Add backend to path
sys.path.append(os.getcwd())

# Mock supabase
mock_supabase = MagicMock()
sys.modules["database"] = MagicMock()
import database
database.supabase = mock_supabase

from logic_utils import format_sms_datetime, parse_iso_datetime

def test_sms_localization():
    print("Testing format_sms_datetime localization...")
    
    # Mock club timezone as EST (UTC-5)
    mock_supabase.table("clubs").select().eq().execute.return_value.data = [{"timezone": "America/New_York"}]
    
    # 11:00 PM UTC = 6:00 PM EST
    utc_dt = parse_iso_datetime("2026-01-04T23:00:00Z")
    
    # Test with club_id (should be 6pm)
    formatted_est = format_sms_datetime(utc_dt, club_id="club_est")
    print(f"UTC 23:00 -> EST: {formatted_est}")
    assert "6pm" in formatted_est
    assert "Sun, Jan 4th" in formatted_est

    # 11:00 PM UTC = 11:00 PM UTC (No localization if no club_id)
    formatted_utc = format_sms_datetime(utc_dt)
    print(f"UTC 23:00 -> No Club: {formatted_utc}")
    assert "11pm" in formatted_utc

    # Test with different timezone (London)
    # 11:00 PM UTC = 11:00 PM GMT
    mock_supabase.table("clubs").select().eq().execute.return_value.data = [{"timezone": "Europe/London"}]
    formatted_london = format_sms_datetime(utc_dt, club_id="club_london")
    print(f"UTC 23:00 -> London: {formatted_london}")
    assert "11pm" in formatted_london

    # Test with Pacific Time (UTC-8)
    # 11:00 PM UTC = 3:00 PM PST
    mock_supabase.table("clubs").select().eq().execute.return_value.data = [{"timezone": "America/Los_Angeles"}]
    formatted_pst = format_sms_datetime(utc_dt, club_id="club_pst")
    print(f"UTC 23:00 -> PST: {formatted_pst}")
    assert "3pm" in formatted_pst

    print("\nVerification complete - SMS localization works perfectly.")

if __name__ == "__main__":
    test_sms_localization()
