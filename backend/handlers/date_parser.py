"""
Natural language date/time parser for SMS PLAY command.
Uses dateparser library to handle inputs like "tomorrow at 6pm", "next Saturday 2pm".
Includes SMS shorthand normalization for common texting abbreviations.
"""
from datetime import datetime
from typing import Tuple, Optional
import re

try:
    import dateparser
    DATEPARSER_AVAILABLE = True
except ImportError:
    DATEPARSER_AVAILABLE = False
    print("[WARNING] dateparser not installed - NLP date parsing disabled")


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
    
    # If dateparser is not available, return None to fall back to strict format
    if not DATEPARSER_AVAILABLE:
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
        # Normalize SMS shorthand before parsing
        normalized_text = normalize_sms_text(text)
        
        # Strip common noise words that aren't dates but often appear in SMS
        # like "play around", "at", "match", "request", "game"
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
        # CRITICAL: We must compare apples to apples (New York vs New York)
        import pytz
        tz = pytz.timezone(timezone)
        now_in_tz = datetime.now(tz).replace(tzinfo=None)
        
        if parsed < now_in_tz:
            print(f"[date_parser] Rejecting past date: {parsed} (current time in {timezone}: {now_in_tz})")
            # If it's earlier today, it's probably meant for tomorrow
            # But for explicit past dates, we should reject
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
