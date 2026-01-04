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
    if not club_id:
        return "America/New_York"
    try:
        result = supabase.table("clubs").select("timezone").eq("club_id", club_id).execute()
        if result.data and result.data[0].get("timezone"):
            return result.data[0]["timezone"]
    except Exception as e:
        # Fallback if column doesn't exist or query fails
        print(f"Note: Could not fetch timezone for club {club_id}, defaulting to America/New_York: {e}")
    return "America/New_York"

def to_utc_iso(dt_str: str, club_id: str) -> str:
    """
    Convert a naive local datetime string to a UTC ISO string.
    The input dt_str is assumed to be in the club's local timezone.
    If it's already aware, it just converts to UTC.
    """
    if not dt_str:
        return None
        
    try:
        # Use our robust parser first
        dt = parse_iso_datetime(dt_str)
        
        # If the original string didn't have timezone info, it was parsed as UTC by parse_iso_datetime
        # But we actually want to interpret it as the club's local time if it was naive.
        # Check if the original string had timezone indicator
        is_naive_string = 'Z' not in dt_str and '+' not in dt_str and '-' not in dt_str[11:]
        
        if is_naive_string:
            timezone_str = get_club_timezone(club_id)
            local_tz = pytz.timezone(timezone_str)
            # Replace the assumed UTC with None to make it naive, then localize correctly
            dt_naive = dt.replace(tzinfo=None)
            dt_local = local_tz.localize(dt_naive)
            return dt_local.astimezone(timezone.utc).isoformat()
        else:
            # Already has TZ info, ensure it's UTC
            return dt.astimezone(timezone.utc).isoformat()
    except Exception as e:
        print(f"Error converting to UTC ISO: {e}")
        return dt_str # Return as-is on failure (best effort)


def get_quiet_hours_info(club_id: str) -> tuple[bool, int]:
    """
    Returns (is_quiet, end_hour) for a specific club.
    Default quiet hours are 9:00 PM to 8:00 AM.
    """
    settings = get_club_settings(club_id)
    timezone_str = get_club_timezone(club_id)
    
    quiet_start = settings.get("quiet_hours_start", 21)
    quiet_end = settings.get("quiet_hours_end", 8)
    
    try:
        tz = pytz.timezone(timezone_str)
    except Exception:
        tz = pytz.timezone("America/New_York")
        
    now = datetime.now(tz)
    current_hour = now.hour
    
    is_quiet = False
    if quiet_start > quiet_end:
        if current_hour >= quiet_start or current_hour < quiet_end:
            is_quiet = True
    else:
        if quiet_start <= current_hour < quiet_end:
            is_quiet = True
            
    return is_quiet, quiet_end


def is_quiet_hours(club_id: str) -> bool:
    """Check if current time is within quiet hours for a specific club."""
    is_quiet, _ = get_quiet_hours_info(club_id)
    return is_quiet


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

def format_sms_datetime(dt: datetime, club_id: str = None) -> str:
    """
    Format a datetime for user-friendly SMS output.
    Example: 'Fri, Dec 26th @ 4pm'
    If club_id is provided, localizes the datetime to the club's timezone.
    """
    if not dt:
        return "the scheduled time"
    
    # Localize if club_id is provided and dt is aware
    if club_id and dt.tzinfo:
        timezone_str = get_club_timezone(club_id)
        try:
            local_tz = pytz.timezone(timezone_str)
            dt = dt.astimezone(local_tz)
        except Exception as e:
            print(f"Error localizing for SMS: {e}")
        
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

def normalize_score(score_str: str) -> str:
    """
    Standardize match scores into a comma-separated format: '6-4, 6-2'.
    Handles common formats from AI: '6-4 6-2', '6/4 6/2', '6-4, 6-2'.
    """
    if not score_str:
        return ""
    
    # Replace slashes with dashes
    score = score_str.replace('/', '-')
    
    # Split by common separators (comma, or space if preceded by digit and followed by digit)
    # Using regex to find sets which look like "D-D"
    import re
    sets = re.findall(r'\d+-\d+', score)
    
    if sets:
        return ", ".join(sets)
    
    return score_str # Fallback to original if we can't parse it
