from datetime import datetime, timezone
import pytz
from database import supabase

def get_club_settings(club_id: str) -> dict:
    """Retrieve settings for a given club."""
    try:
        result = supabase.table("clubs").select("settings").eq("club_id", club_id).execute()
        if result.data and result.data[0].get("settings"):
            return result.data[0]["settings"]
    except Exception as e:
        print(f"Error getting club settings: {e}")
    return {}

def get_club_timezone(club_id: str) -> str:
    """Retrieve the timezone for a given club, defaulting to America/New_York."""
    try:
        result = supabase.table("clubs").select("timezone").eq("club_id", club_id).execute()
        if result.data and result.data[0].get("timezone"):
            return result.data[0]["timezone"]
    except Exception as e:
        # Fallback if column doesn't exist or query fails
        print(f"Note: Could not fetch timezone for club {club_id}, defaulting to America/New_York: {e}")
    return "America/New_York"


def is_quiet_hours(club_id: str) -> bool:
    """
    Check if current time is within quiet hours for a specific club.
    Default quiet hours are 9:00 PM to 8:00 AM in the club's local timezone.
    """
    settings = get_club_settings(club_id)
    timezone_str = get_club_timezone(club_id)
    
    # Get hours (0-23 format)
    # Default: 9 PM (21) to 8 AM (8)
    quiet_start = settings.get("quiet_hours_start", 21)
    quiet_end = settings.get("quiet_hours_end", 8)
    
    # Get current time in club's timezone
    try:
        tz = pytz.timezone(timezone_str)
    except Exception:
        tz = pytz.timezone("America/New_York")
        
    now = datetime.now(tz)
    current_hour = now.hour
    
    # Handle overnight quiet hours (e.g. 21 to 8)
    if quiet_start > quiet_end:
        # e.g. 21 (9pm) to 8 (8am)
        # Quiet if hour >= 21 OR hour < 8
        if current_hour >= quiet_start or current_hour < quiet_end:
            return True
    else:
        # e.g. 2 to 5 (not likely but possible)
        # Quiet if hour >= 2 AND hour < 5
        if quiet_start <= current_hour < quiet_end:
            return True
            
    return False


def get_booking_url(club: dict) -> str:
    """Generate a booking URL based on the club's booking system and slug."""
    system = (club.get("booking_system") or "").lower()
    slug = club.get("booking_slug")
    
    if system == "playbypoint" and slug:
        return f"https://{slug}.playbypoint.com/book/{slug}"
    elif system == "playtomic":
        return "https://playtomic.io"
    elif system == "matchi":
        return "https://www.matchi.se"
    
    # Generic fallbacks
    if system == "playbypoint":
        return "https://playbypoint.com"
    
    return "the booking portal"

def parse_iso_datetime(dt_str: str) -> datetime:
    """
    Robustly parse ISO datetime strings from Javascript or Postgres.
    Handles 'Z' suffix and varying microsecond precision.
    """
    if not dt_str:
        return None
        
    # Replace 'Z' with UTC offset for across-version compatibility
    clean_dt = dt_str.replace('Z', '+00:00')
    
    try:
        return datetime.fromisoformat(clean_dt)
    except ValueError:
        # Fallback for weird precisions or formats
        # datetime.fromisoformat can be picky about the number of sub-second digits in older Python
        try:
            # Try removing sub-seconds if they are the problem
            if '.' in clean_dt:
                base, fraction = clean_dt.split('.')
                # Keep up to 6 digits for microseconds, but handle variable lengths
                if '+' in fraction:
                    frac_part, tz_part = fraction.split('+')
                    clean_dt = f"{base}.{frac_part[:6].ljust(6, '0')}+{tz_part}"
                elif '-' in fraction:
                    frac_part, tz_part = fraction.split('-')
                    clean_dt = f"{base}.{frac_part[:6].ljust(6, '0')}-{tz_part}"
                else:
                    clean_dt = f"{base}.{fraction[:6].ljust(6, '0')}"
                return datetime.fromisoformat(clean_dt)
        except Exception:
            pass
            
        # Last resort: common formats
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(dt_str.split('+')[0].split('Z')[0], fmt)
            except ValueError:
                continue
                
    raise ValueError(f"Invalid isoformat string: '{dt_str}'")

def format_sms_datetime(dt: datetime) -> str:
    """
    Format a datetime for user-friendly SMS output.
    Example: 'Fri, Dec 26th @ 4pm'
    """
    if not dt:
        return "the scheduled time"
        
    day = dt.day
    if 11 <= day <= 13:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(day % 10, 'th')
        
    # Format: Fri, Dec 26th @ 4pm
    # %a (Fri), %b (Dec), %d (26)
    # %I (04), %p (PM) -> manual strip of leading zero
    day_str = dt.strftime(f"%a, %b {day}{suffix}")
    time_str = dt.strftime("%I:%M%p").lower()
    
    # Clean up time: 04:00pm -> 4pm, 04:30pm -> 4:30pm
    if time_str.startswith('0'):
        time_str = time_str[1:]
    time_str = time_str.replace(':00', '')
    
    return f"{day_str} @ {time_str}"
