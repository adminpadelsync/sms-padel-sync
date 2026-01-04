import sys
import os
from unittest.mock import MagicMock
from datetime import datetime
import pytz

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock supabase
mock_supabase = MagicMock()
sys.modules["database"] = MagicMock()
import database
database.supabase = mock_supabase

from logic_utils import to_utc_iso

def test_timezone_conversion():
    print("Testing to_utc_iso logic...")
    
    # Mock club timezone as EST (UTC-5)
    mock_supabase.table("clubs").select().eq().execute.return_value.data = [{"timezone": "America/New_York"}]
    
    # Case 1: Naive ISO string (represents local time)
    # 4 PM EST = 9 PM UTC
    dt_str = "2026-01-04T16:00:00"
    utc_iso = to_utc_iso(dt_str, "c123")
    print(f"Naive EST: {dt_str} -> {utc_iso}")
    assert "T21:00:00+00:00" in utc_iso
    
    # Case 2: Aware UTC string (should stay UTC)
    dt_str_utc = "2026-01-04T16:00:00Z"
    utc_iso_2 = to_utc_iso(dt_str_utc, "c123")
    print(f"Aware UTC: {dt_str_utc} -> {utc_iso_2}")
    assert "T16:00:00+00:00" in utc_iso_2
    
    # Case 3: Aware Local string (should convert to UTC)
    # 4 PM EST = 9 PM UTC
    dt_str_est = "2026-01-04T16:00:00-05:00"
    utc_iso_3 = to_utc_iso(dt_str_est, "c123")
    print(f"Aware EST: {dt_str_est} -> {utc_iso_3}")
    assert "T21:00:00+00:00" in utc_iso_3

    # Case 4: Different timezone (London UTC+0/BST+1)
    # 4 PM London (Jan is GMT/UTC+0) = 4 PM UTC
    mock_supabase.table("clubs").select().eq().execute.return_value.data = [{"timezone": "Europe/London"}]
    dt_str_london = "2026-01-04T16:00:00"
    utc_iso_4 = to_utc_iso(dt_str_london, "cLondon")
    print(f"Naive London (Jan): {dt_str_london} -> {utc_iso_4}")
    assert "T16:00:00+00:00" in utc_iso_4

    print("\nVerification complete - All tests passed.")

if __name__ == "__main__":
    test_timezone_conversion()
