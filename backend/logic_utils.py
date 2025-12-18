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

def is_quiet_hours(club_id: str) -> bool:
    """
    Check if current time is within quiet hours for a specific club.
    Default quiet hours are 9:00 PM to 8:00 AM ET.
    """
    settings = get_club_settings(club_id)
    
    # Get hours (0-23 format)
    # Default: 9 PM (21) to 8 AM (8)
    quiet_start = settings.get("quiet_hours_start", 21)
    quiet_end = settings.get("quiet_hours_end", 8)
    
    # Get current time in New York
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
