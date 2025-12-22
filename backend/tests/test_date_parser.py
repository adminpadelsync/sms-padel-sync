"""
Unit tests for natural language date parsing.
"""
import sys
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, '/Users/adamrogers/Documents/sms-padel-sync/backend')

from handlers.date_parser import parse_natural_date, format_datetime_for_sms


def test_nlp_parsing():
    """Test various natural language date inputs."""
    print("--- Testing NLP Date Parser ---\n")
    
    test_cases = [
        "tomorrow at 6pm",
        "tomorrow 6pm",
        "next Saturday 2pm",
        "Saturday at 2pm",
        "Friday morning",
        "Dec 15 6pm",
        "December 15 at 6:00 PM",
        "next week Monday 7pm",
        "in 2 days at noon",
        "12/20 at 3pm",
    ]
    
    for test_input in test_cases:
        parsed_dt, human_readable, iso_format = parse_natural_date(test_input)
        
        if parsed_dt:
            print(f"✅ '{test_input}'")
            print(f"   → {human_readable}")
            print(f"   → {iso_format}")
        else:
            print(f"❌ '{test_input}' - Could not parse")
        print()
    
    # Test invalid inputs
    print("--- Testing Invalid Inputs ---\n")
    invalid_cases = [
        "hello world",
        "asdfasdf",
        "",
        "   ",
    ]
    
    for test_input in invalid_cases:
        parsed_dt, human_readable, iso_format = parse_natural_date(test_input)
        
        if parsed_dt is None:
            print(f"✅ '{test_input}' - Correctly returned None")
        else:
            print(f"❌ '{test_input}' - Unexpectedly parsed to {human_readable}")
        print()
    
    # Test strict format fallback
    print("--- Testing Strict Format (YYYY-MM-DD HH:MM) ---\n")
    strict_cases = [
        "2023-12-15 18:00",
        "2024-01-01 14:30",
    ]
    
    for test_input in strict_cases:
        parsed_dt, human_readable, iso_format = parse_natural_date(test_input)
        
        if parsed_dt:
            print(f"✅ '{test_input}'")
            print(f"   → {human_readable}")
        else:
            print(f"❌ '{test_input}' - Could not parse (this format needs fallback in handler)")
        print()


if __name__ == "__main__":
    test_nlp_parsing()
