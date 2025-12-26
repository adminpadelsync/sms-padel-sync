"""
Natural language date/time parser for SMS PLAY command.
Uses dateparser library to handle inputs like "tomorrow at 6pm", "next Saturday 2pm".
Includes SMS shorthand normalization for common texting abbreviations.
"""
from datetime import datetime
from typing import Tuple, Optional
import re
from logic_utils import format_sms_datetime

DATEPARSER_AVAILABLE = None
DATEUTIL_AVAILABLE = None
SIX_AVAILABLE = None

def _check_dependencies():
    global DATEPARSER_AVAILABLE, DATEUTIL_AVAILABLE, SIX_AVAILABLE
    if DATEPARSER_AVAILABLE is not None:
        return

    try:
        import dateparser
        DATEPARSER_AVAILABLE = True
    except Exception as e:
        DATEPARSER_AVAILABLE = False
        print(f"[ERROR] dateparser import failed: {e}")

    try:
        import dateutil.parser
        DATEUTIL_AVAILABLE = True
    except Exception as e:
        DATEUTIL_AVAILABLE = False
        print(f"[ERROR] dateutil import failed: {e}")
        
    try:
        import six
        SIX_AVAILABLE = True
        print(f"[DEBUG] six version: {getattr(six, '__version__', 'unknown')}")
        try:
            from six.moves import _thread
            print("[DEBUG] six.moves is available")
        except Exception as e:
             print(f"[ERROR] six.moves check failed: {e}")
    except Exception as e:
        SIX_AVAILABLE = False
        print(f"[ERROR] six import failed: {e}")


# SMS shorthand mappings - common texting abbreviations
# Order matters: longer patterns should come first to avoid partial matches
SMS_SHORTHAND_MAP = {
    # Tomorrow variants (most common issue)
    'tmrw': 'tomorrow',
    'tmr': 'tomorrow',
    'tmw': 'tomorrow',
    'tom': 'tomorrow',
    '2morrow': 'tomorrow',
    '2moro': 'tomorrow',
    '2mora': 'tomorrow',
    '2mrw': 'tomorrow',
    '2mro': 'tomorrow',
    'tomoro': 'tomorrow',
    'tomoz': 'tomorrow',
    
    # Today
    '2day': 'today',
    
    # Tonight variants
    'tonite': 'tonight',
    '2nite': 'tonight',
    '2night': 'tonight',
    
    # Time of day
    'mornin': 'morning',
    'morn': 'morning',
    'aftn': 'afternoon',
    'aft': 'afternoon',
    'eve': 'evening',
    'nite': 'night',
    
    # Weekend/week
    'wkend': 'weekend',
    'wknd': 'weekend',
    'wk': 'week',
    
    # Next
    'nxt': 'next',
    
    # Days of week (abbreviated)
    'thurs': 'thursday',
    'thur': 'thursday',
    'thu': 'thursday',
    'tues': 'tuesday',
    'tue': 'tuesday',
    'weds': 'wednesday',
    'wed': 'wednesday',
    'sat': 'saturday',
    'sun': 'sunday',
    'mon': 'monday',
    'fri': 'friday',
}


def normalize_sms_text(text: str) -> str:
    """
    Normalize SMS shorthand to standard English for dateparser.
    
    Uses word boundary matching to avoid false positives
    (e.g., 'saturday' shouldn't become 'satturday').
    
    Args:
        text: Raw SMS input like "tom at 12pm" or "nxt sat 2pm"
        
    Returns:
        Normalized text like "tomorrow at 12pm" or "next saturday 2pm"
    """
    if not text:
        return text
    
    normalized = text.lower().strip()
    
    # Sort by length (longest first) to avoid partial replacements
    # e.g., 'thurs' should be replaced before 'thu'
    sorted_shortcuts = sorted(SMS_SHORTHAND_MAP.keys(), key=len, reverse=True)
    
    for shorthand in sorted_shortcuts:
        full_word = SMS_SHORTHAND_MAP[shorthand]
        # Use word boundaries to avoid replacing parts of words
        # \b matches word boundaries (spaces, punctuation, start/end)
        pattern = r'\b' + re.escape(shorthand) + r'\b'
        normalized = re.sub(pattern, full_word, normalized, flags=re.IGNORECASE)
    
    return normalized



def _manual_regex_fallback(text: str, timezone: str) -> Tuple[Optional[datetime], Optional[str], Optional[str]]:
    """
    Final safety net: Parse common patterns using only re and datetime.
    Supports: "today at 4pm", "tomorrow 6:30", "4pm", etc.
    """
    try:
        import pytz
        from datetime import timedelta
        tz = pytz.timezone(timezone)
        now_in_tz = datetime.now(tz).replace(tzinfo=None)
        
        clean = text.lower().strip()
        
        # 1. Determine base date
        base_date = now_in_tz
        has_relative = False
        if "tomorrow" in clean:
            base_date = now_in_tz + timedelta(days=1)
            clean = clean.replace("tomorrow", "")
            has_relative = True
        elif "today" in clean:
            clean = clean.replace("today", "")
            has_relative = True
        
        # 2. Extract time using regex
        # Look for patterns like "4pm", "4:30pm", "16:00", "at 4"
        time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', clean)
        if not time_match:
            # If we only have "today" or "tomorrow", maybe default to a sensible time?
            # But better to return None and let it ask.
            return None, None, None
            
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        meridiem = time_match.group(3)
        
        # Adjust for AM/PM
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        elif not meridiem:
            # Heuristic: if hour is small (1-7), assume PM
            if 1 <= hour <= 8:
                hour += 12
        
        parsed_dt = base_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If it's today and in the past (more than 1 hour ago), we reject or nudge
        buffer_time = now_in_tz - timedelta(hours=1)
        if parsed_dt < buffer_time:
             # Basic heuristic: if it's earlier today, they likely meant tomorrow or 
             # just missed the window.
             return None, None, None
             
        human_readable = format_sms_datetime(parsed_dt)
        print(f"[date_parser] Regex Fallback Success! '{text}' -> {human_readable}")
        return parsed_dt, human_readable, parsed_dt.isoformat()
        
    except Exception as e:
        print(f"[date_parser] Regex fallback failed: {e}")
        return None, None, None


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
    
    # Use zero-dependency regex fallback directly
    return _manual_regex_fallback(text, timezone)


def format_datetime_for_sms(dt: datetime) -> str:
    """
    Format a datetime object for SMS display.
    
    Args:
        dt: datetime object
        
    Returns:
        Human-readable string like "Wed, Dec 11 at 6:00 PM"
    """
    return format_sms_datetime(dt)
