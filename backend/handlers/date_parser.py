"""
Natural language date/time parser for SMS PLAY command.
Uses dateparser library to handle inputs like "tomorrow at 6pm", "next Saturday 2pm".
"""
from datetime import datetime
from typing import Tuple, Optional
import dateparser


def parse_natural_date(
    text: str, 
    timezone: str = "America/New_York"
) -> Tuple[Optional[datetime], Optional[str], Optional[str]]:
    """
    Parse natural language date/time input.
    
    Args:
        text: User input like "tomorrow at 6pm" or "next Saturday 2pm"
        timezone: IANA timezone string for relative date calculations
        
    Returns:
        Tuple of:
            - datetime object (or None if parsing failed)
            - human-readable string for confirmation (or None)
            - ISO format string for storage (or None)
    """
    if not text or not text.strip():
        return None, None, None
    
    # Configure dateparser to prefer future dates
    settings = {
        'PREFER_DATES_FROM': 'future',
        'TIMEZONE': timezone,
        'RETURN_AS_TIMEZONE_AWARE': False,
        'PREFER_DAY_OF_MONTH': 'first',
        'DATE_ORDER': 'MDY',  # American date format
    }
    
    try:
        parsed = dateparser.parse(text.strip(), settings=settings)
        
        if parsed is None:
            return None, None, None
        
        # Check if the parsed date is in the past
        now = datetime.now()
        if parsed < now:
            # If it's earlier today, it's probably meant for tomorrow
            # But for explicit past dates, we should reject
            # dateparser with PREFER_DATES_FROM='future' should handle most cases
            return None, None, None
        
        # Format for human-readable confirmation
        # Example: "Wed, Dec 11 at 6:00 PM"
        human_readable = parsed.strftime("%a, %b %d at %I:%M %p")
        
        # ISO format for database storage
        iso_format = parsed.isoformat()
        
        return parsed, human_readable, iso_format
        
    except Exception as e:
        print(f"[date_parser] Error parsing '{text}': {e}")
        return None, None, None


def format_datetime_for_sms(dt: datetime) -> str:
    """
    Format a datetime object for SMS display.
    
    Args:
        dt: datetime object
        
    Returns:
        Human-readable string like "Wed, Dec 11 at 6:00 PM"
    """
    return dt.strftime("%a, %b %d at %I:%M %p")
