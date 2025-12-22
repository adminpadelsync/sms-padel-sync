from datetime import datetime
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
