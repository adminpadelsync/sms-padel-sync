"""
Result Nudge Scheduler - Proactively asks match originators for scores post-match.
Exactly like feedback_scheduler but only for the originator to report the Elo result.
"""

from datetime import datetime, timedelta
from database import supabase
from logic_utils import get_club_settings, is_quiet_hours, get_club_timezone
import sms_constants as msg
import pytz

# Default: 2 hours after match start (assuming 90 min match + 30 min buffer)
DEFAULT_RESULT_NUDGE_DELAY_HOURS = 2.0

def get_matches_needing_result_nudge():
    """
    Find matches that recently ended and haven't had a result reported yet.
    Only nudge the originator.
    """
    matches_to_process = []
    
    # Get all clubs
    clubs_result = supabase.table("clubs").select("club_id, settings, timezone").eq("active", True).execute()
    
    for club in clubs_result.data:
        club_id = club["club_id"]
        settings = club.get("settings") or {}
        timezone_str = club.get("timezone") or "America/New_York"
        delay_hours = float(settings.get("result_nudge_delay_hours", DEFAULT_RESULT_NUDGE_DELAY_HOURS))
        
        try:
            tz = pytz.timezone(timezone_str)
        except Exception:
            tz = pytz.timezone("America/New_York")
            
        now_local = datetime.now(tz).replace(tzinfo=None)
        cutoff_time = now_local - timedelta(hours=delay_hours)
        lookback_limit = now_local - timedelta(hours=24)
        
        # Query matches for this club that are confirmed but NOT completed
        # AND have received fewer than 2 nudges
        result = supabase.table("matches").select("*").eq(
            "club_id", club_id
        ).eq(
            "status", "confirmed"
        ).is_(
            "score_text", "null"
        ).lt(
            "result_nudge_count", 2
        ).gte(
            "scheduled_time", lookback_limit.isoformat()
        ).lte(
            "scheduled_time", cutoff_time.isoformat()
        ).execute()
        
        matches = result.data if result.data else []
        
        # Filter in Python for the 4-hour spacing logic if it's the second nudge
        for match in matches:
            nudge_count = match.get("result_nudge_count", 0)
            
            if nudge_count == 0:
                # First nudge - already filtered by scheduled_time <= cutoff_time
                matches_to_process.append(match)
            elif nudge_count == 1:
                # Second nudge - check if 4 hours have passed since last nudge
                last_nudge_at_str = match.get("last_result_nudge_at")
                if last_nudge_at_str:
                    try:
                        last_nudge_at = datetime.fromisoformat(last_nudge_at_str.replace('Z', '+00:00')).replace(tzinfo=None)
                        if now_local >= last_nudge_at + timedelta(hours=4):
                            matches_to_process.append(match)
                    except Exception:
                        # Fallback if parsing fails
                        matches_to_process.append(match)
                else:
                    # If count is 1 but timestamp is missing, nudge again
                    matches_to_process.append(match)
    
    return matches_to_process

def send_result_nudge_for_match(match: dict):
    """
    Send a nudge SMS to the match originator.
    """
    match_id = match["match_id"]
    club_id = match.get("club_id")
    originator_id = match.get("originator_id")
    
    if not originator_id:
        return 0
        
    if is_quiet_hours(club_id):
        return 0
        
    # Get originator phone
    player_res = supabase.table("players").select("phone_number, name").eq("player_id", originator_id).execute()
    if not player_res.data:
        return 0
    player = player_res.data[0]
    
    club_name = "the club"
    if club_id:
        club_res = supabase.table("clubs").select("name").eq("club_id", club_id).execute()
        if club_res.data:
            club_name = club_res.data[0]["name"]

    # Determine nudge message
    nudge_count = match.get("result_nudge_count", 0)
    if nudge_count == 0:
        nudge_msg = f"🎾 {club_name}: How did your match go? 🏸\n\nReply with the teams and score to update your Sync Rating! (e.g. 'Dave and I beat Sarah and Mike 6-4 6-2')"
    else:
        nudge_msg = f"🎾 {club_name}: Just a follow-up—did you get a result for your match? 🏸\n\nReply back with the score so everyone's ratings stay accurate! 🎾"
    
    from twilio_client import send_sms
    if send_sms(player["phone_number"], nudge_msg):
        # Update match with nudge tracking
        new_count = nudge_count + 1
        supabase.table("matches").update({
            "result_nudge_count": new_count,
            "last_result_nudge_at": datetime.now().isoformat()
        }).eq("match_id", match_id).execute()
        
        print(f"Sent result nudge #{new_count} to {player['name']} for match {match_id}")
        return 1
    return 0

def run_result_nudge_scheduler():
    """Main entry for cron."""
    matches = get_matches_needing_result_nudge()
    sent_count = 0
    for match in matches:
        sent_count += send_result_nudge_for_match(match)
    return {
        "matches_checked": len(matches),
        "nudges_sent": sent_count
    }
