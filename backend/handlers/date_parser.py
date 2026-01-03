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
        
        # Weekdays
        weekdays = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        
        found_weekday = False
        for day_name, day_idx in weekdays.items():
            if day_name in clean:
                days_ahead = day_idx - now_in_tz.weekday()
                if days_ahead <= 0: # Target day is today or had happened
                    days_ahead += 7
                base_date = now_in_tz + timedelta(days=days_ahead)
                clean = clean.replace(day_name, "")
                has_relative = True
                found_weekday = True
                break
        
        if not found_weekday:
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
            return None, None, None
            
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        meridiem = (time_match.group(3) or "").lower()
        
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
        
        # If it's today and in the past, nudge to tomorrow if they didn't specify day
        if not has_relative and parsed_dt < now_in_tz:
             parsed_dt += timedelta(days=1)
             
        human_readable = format_sms_datetime(parsed_dt)
        print(f"[date_parser] Regex Fallback Success! '{text}' -> {human_readable}")
        return parsed_dt, human_readable, parsed_dt.isoformat()
        
    except Exception as e:
        print(f"[date_parser] Regex fallback failed: {e}")
        return None, None, None


def parse_natural_date_with_context(
    text: str, 
    base_dt: Optional[datetime] = None,
    timezone: str = "America/New_York"
) -> Tuple[Optional[datetime], Optional[str], Optional[str]]:
    """
    Parse a date/time string, using base_dt as context if it's a partial time update.
    Example: "5pm" with base_dt of "2026-01-02 16:00" -> "2026-01-02 17:00"
    """
    # 1. Parse normally first
    parsed_dt, human, iso = parse_natural_date(text, timezone)
    
    if not parsed_dt or not base_dt:
        return parsed_dt, human, iso

    # 2. Check if the input was likely "just a time"
    # Heuristic: if normalized text doesn't contain day/date words but does have time patterns
    clean = normalize_sms_text(text).lower()
    day_words = ['tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'monday', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', '/']
    
    has_day_context = any(word in clean for word in day_words)
    time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', clean)
    
    # If the user ONLY provided a time without a day word, we merge with base_dt's date
    if not has_day_context and time_match:
        print(f"[date_parser] Merging partial time '{text}' with base date {base_dt.date()}")
        merged_dt = base_dt.replace(
            hour=parsed_dt.hour, 
            minute=parsed_dt.minute, 
            second=0, 
            microsecond=0
        )
        return merged_dt, format_sms_datetime(merged_dt), merged_dt.isoformat()

    return parsed_dt, human, iso


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

    _check_dependencies()
    
    clean_text = normalize_sms_text(text)
    
    # 1. Try dateparser (best results, handles weekdays/relatives)
    if DATEPARSER_AVAILABLE:
        try:
            import dateparser
            import pytz
            tz = pytz.timezone(timezone)
            now_in_tz = datetime.now(tz).replace(tzinfo=None)
            
            # Use relative base to ensure "Monday" means next Monday correctly
            parsed = dateparser.parse(clean_text, settings={
                'RELATIVE_BASE': now_in_tz,
                'PREFER_DATES_FROM': 'future'
            })
            
            if parsed:
                from logic_utils import format_sms_datetime
                human_readable = format_sms_datetime(parsed)
                return parsed, human_readable, parsed.isoformat()
        except Exception as e:
            print(f"[date_parser] dateparser failed: {e}")

    # 2. Fallback to manual regex parsing
    return _manual_regex_fallback(clean_text, timezone)


def format_datetime_for_sms(dt: datetime) -> str:
    """
    Format a datetime object for SMS display.
    
    Args:
        dt: datetime object
        
    Returns:
        Human-readable string like "Wed, Dec 11 at 6:00 PM"
    """
    return format_sms_datetime(dt)
