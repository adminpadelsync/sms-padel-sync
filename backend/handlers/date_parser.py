"""
Natural language date/time parser for SMS PLAY command.
Uses dateparser library to handle inputs like "tomorrow at 6pm", "next Saturday 2pm".
Includes SMS shorthand normalization for common texting abbreviations.
"""
from datetime import datetime
from typing import Tuple, Optional
import re

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
    except ImportError:
        DATEPARSER_AVAILABLE = False
        print("[WARNING] dateparser not installed")

    try:
        import dateutil.parser
        DATEUTIL_AVAILABLE = True
    except ImportError:
        DATEUTIL_AVAILABLE = False
        print("[WARNING] dateutil not installed")
        
    try:
        import six
        SIX_AVAILABLE = True
    except ImportError:
        SIX_AVAILABLE = False
        print("[WARNING] six not installed")


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
    
    # If dateparser is not available, use fallback logic
    if not DATEPARSER_AVAILABLE:
        if not DATEUTIL_AVAILABLE:
            print("[date_parser] No parsing libraries available (dateparser/dateutil missing)")
            return None, None, None
            
        try:
            import dateutil.parser
            normalized_text = normalize_sms_text(text)
            
            # Basic noise stripping
            noise_words = [r'\bplay\b', r'\bmatch\b', r'\bgame\b', r'\baround\b', r'\bat\b']
            cleaned_text = normalized_text
            for noise in noise_words:
                cleaned_text = re.sub(noise, '', cleaned_text, flags=re.IGNORECASE)
            cleaned_text = ' '.join(cleaned_text.split())
            
            # Manual handle for "today" and "tomorrow" 
            import pytz
            from datetime import timedelta
            tz = pytz.timezone(timezone)
            now_in_tz = datetime.now(tz).replace(tzinfo=None)
            
            base_date = now_in_tz
            has_relative = False
            if "tomorrow" in cleaned_text:
                base_date = now_in_tz + timedelta(days=1)
                cleaned_text = cleaned_text.replace("tomorrow", "").strip()
                has_relative = True
            elif "today" in cleaned_text:
                cleaned_text = cleaned_text.replace("today", "").strip()
                has_relative = True
            
            # If after removal, there is nothing left and no relative word, fail
            if not cleaned_text and not has_relative:
                return None, None, None
                
            # Try parsing the remaining part with dateutil
            parsed_time = dateutil.parser.parse(cleaned_text, default=base_date, fuzzy=True)
            
            # Buffer/Grace period: allow requests up to 1 hour in the past 
            buffer_time = now_in_tz - timedelta(hours=1)
            
            if parsed_time < buffer_time:
                return None, None, None
            
            human_readable = parsed_time.strftime("%a, %b %d at %I:%M %p")
            print(f"[date_parser] Fallback Success! '{text}' -> {human_readable}")
            return parsed_time, human_readable, parsed_time.isoformat()
            
        except Exception as fallback_err:
            print(f"[date_parser] Fallback failed for '{text}': {fallback_err}")
            return None, None, None
    
    # If we are here, dateparser IS available
    import dateparser
    
    # Configure dateparser to prefer future dates
    settings = {
        'PREFER_DATES_FROM': 'future',
        'TIMEZONE': timezone,
        'RETURN_AS_TIMEZONE_AWARE': False,
        'PREFER_DAY_OF_MONTH': 'first',
        'DATE_ORDER': 'MDY',  # American date format
    }
    
    try:
        # Normalize SMS shorthand before parsing
        normalized_text = normalize_sms_text(text)
        
        # Strip common noise words
        noise_words = [
            r'\bplay\b', r'\bmatch\b', r'\bgame\b', r'\baround\b', r'\bround\b', 
            r'\bat\b', r'\bi\b', r'\bwanted\b', r'\btry\b', r'\bto\b', r'\bfor\b',
            r'\bplease\b', r'\bcan\b', r'\bu\b', r'\byou\b', r'\bwant\b', r'\bwould\b', r'\blike\b',
            r'\bit\b', r'\bthe\b', r'\bsomething\b', r'\barnd\b'
        ]
        cleaned_text = normalized_text
        for noise in noise_words:
            cleaned_text = re.sub(noise, '', cleaned_text, flags=re.IGNORECASE)
        
        # Clean up double spaces
        cleaned_text = ' '.join(cleaned_text.split())
        
        parsed = dateparser.parse(cleaned_text, settings=settings)
        
        if parsed is None:
            print(f"[date_parser] dateparser.parse returned None for cleaned: '{cleaned_text}' (orig: '{text}')")
            return None, None, None
        
        # Check if the parsed date is in the past
        import pytz
        from datetime import timedelta
        tz = pytz.timezone(timezone)
        
        # Current time in the target timezone (naive local)
        now_in_tz = datetime.now(tz).replace(tzinfo=None)
        
        # Buffer/Grace period: allow requests up to 1 hour in the past 
        buffer_time = now_in_tz - timedelta(hours=1)
        
        if parsed < buffer_time:
            print(f"[date_parser] Rejecting past date: {parsed} (current time in {timezone}: {now_in_tz})")
            return None, None, None
        
        # Format for human-readable confirmation
        human_readable = parsed.strftime("%a, %b %d at %I:%M %p")
        iso_format = parsed.isoformat()
        
        print(f"[date_parser] Success! Parsed '{text}' -> {human_readable}")
        return parsed, human_readable, iso_format
        
    except Exception as e:
        import traceback
        print(f"[date_parser] Error parsing '{text}': {e}")
        traceback.print_exc()
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
