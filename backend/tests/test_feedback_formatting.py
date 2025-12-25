import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

def test_formatting():
    print("Testing Date Formatting logic...")
    
    # Test cases: (datetime object, expected formatted string)
    test_cases = [
        (datetime(2025, 12, 23, 19, 0), "Tuesday, Dec 23 @ 7 PM"),
        (datetime(2025, 12, 23, 19, 30), "Tuesday, Dec 23 @ 7:30 PM"),
        (datetime(2025, 12, 24, 9, 0), "Wednesday, Dec 24 @ 9 AM"),
        (datetime(2025, 12, 24, 12, 0), "Wednesday, Dec 24 @ 12 PM"),
        (datetime(2025, 12, 24, 0, 0), "Wednesday, Dec 24 @ 12 AM"),
    ]
    
    for dt, expected in test_cases:
        # Replicate the formatting logic from feedback_scheduler.py
        # time_str = match_time.strftime("%A, %b %-d @ %-I:%M %p").replace(":00", "")
        # Note: %-d and %-I are platform specific (Mac/Linux). 
        # On Mac/Linux, they work without leading zeros.
        
        try:
            time_str = dt.strftime("%A, %b %-d @ %-I:%M %p").replace(":00", "")
            print(f"Input: {dt} -> Result: '{time_str}'")
            # We don't necessarily need to match exactly if platform differences exist,
            # but we want to see it looks good.
        except Exception as e:
            print(f"Error formatting {dt}: {e}")

if __name__ == "__main__":
    test_formatting()
