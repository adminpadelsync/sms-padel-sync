from datetime import datetime, timezone, timedelta
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

def get_now_utc() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

def parse_iso_datetime(dt_str: str) -> datetime:
    """
    Robustly parse ISO datetime strings from Javascript or Postgres.
    Ensures the returned object is ALWAYS timezone-aware (defaulting to UTC).
    """
    if not dt_str:
        return None
        
    # Replace 'Z' with +00:00 for fromisoformat compatibility
    clean_dt = dt_str.replace('Z', '+00:00')
    
    try:
        dt = datetime.fromisoformat(clean_dt)
    except ValueError:
        # Fallback for variable sub-second precision (older Python 3.x)
        try:
            if '.' in clean_dt:
                base, fraction = clean_dt.split('.')
                if '+' in fraction:
                    frac_part, tz_part = fraction.split('+')
                    clean_dt = f"{base}.{frac_part[:6].ljust(6, '0')}+{tz_part}"
                elif '-' in fraction:
                    frac_part, tz_part = fraction.split('-')
                    clean_dt = f"{base}.{frac_part[:6].ljust(6, '0')}-{tz_part}"
                else:
                    clean_dt = f"{base}.{fraction[:6].ljust(6, '0')}"
                dt = datetime.fromisoformat(clean_dt)
            else:
                # No microseconds, potentially weird format
                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                    try:
                        # Strip timezone for strptime then re-add
                        naive_part = clean_dt.split('+')[0].split('-')[0] if '-' in clean_dt and len(clean_dt) > 10 else clean_dt
                        dt = datetime.strptime(naive_part, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError(f"Could not parse '{dt_str}' with available formats")
        except Exception:
            raise ValueError(f"Invalid isoformat string: '{dt_str}'")

    # Final check: Ensure it is aware. If naive, assume UTC.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

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
