"""
Result Nudge Scheduler - Proactively asks match originators for scores post-match.
Exactly like feedback_scheduler but only for the originator to report the Elo result.
"""

from datetime import datetime, timedelta
from database import supabase
from logic_utils import get_club_settings, is_quiet_hours, get_club_timezone, parse_iso_datetime, format_sms_datetime, get_now_utc
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
        now_utc = get_now_utc()
        delay_hours = float(settings.get("result_nudge_delay_hours", DEFAULT_RESULT_NUDGE_DELAY_HOURS))
        cutoff_time = now_utc - timedelta(hours=delay_hours)
        lookback_limit = now_utc - timedelta(hours=24)
        
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
                        last_nudge_at = parse_iso_datetime(last_nudge_at_str)
                        if now_utc >= last_nudge_at + timedelta(hours=4):
                            matches_to_process.append(match)
                    except Exception:
                        # Fallback if parsing fails
                        matches_to_process.append(match)
                else:
                    # If count is 1 but timestamp is missing, nudge again
                    matches_to_process.append(match)
    
    return matches_to_process

def send_result_nudge_for_match(match: dict, is_manual: bool = False):
    """
    Send a nudge SMS to the match originator.
    """
    match_id = match["match_id"]
    club_id = match.get("club_id")
    originator_id = match.get("originator_id")
    
    from logic_utils import get_match_participants
    
    if not originator_id:
        return 0
        
    if not is_manual and is_quiet_hours(club_id):
        return 0
        
    # Get originator phone
    player_res = supabase.table("players").select("phone_number, name").eq("player_id", originator_id).execute()
    if not player_res.data:
        return 0
    player = player_res.data[0]
    
    club_name = "the club"
    timezone_str = "America/New_York"
    if club_id:
        club_res = supabase.table("clubs").select("name, timezone").eq("club_id", club_id).execute()
        if club_res.data:
            club_name = club_res.data[0]["name"]
            timezone_str = club_res.data[0].get("timezone") or "America/New_York"

    # Get Match Context (Time & Players)
    # 1. Time
    scheduled_iso = match.get("scheduled_time")
    match_time_str = "the match"
    if scheduled_iso:
        try:
            dt_utc = parse_iso_datetime(scheduled_iso)
            match_time_str = format_sms_datetime(dt_utc, club_id=club_id)
        except Exception as e:
            print(f"Error formatting nudge time: {e}")

    # 2. Players (Source of Truth: match_participations)
    parts = get_match_participants(match_id)
    all_player_ids = parts["all"]
    
    player_names = []
    if all_player_ids:
        # Fetch names
        p_res = supabase.table("players").select("player_id, name").in_("player_id", all_player_ids).execute()
        for p in (p_res.data or []):
            player_names.append(p.get("name", "Unknown"))
            
    players_list_str = "\n".join([f"• {name}" for name in player_names])

    # Determine nudge message
    nudge_count = match.get("result_nudge_count", 0)
    if nudge_count == 0:
        nudge_msg = f"🎾 {club_name}: How did your match go on {match_time_str}?\n\nAs a reminder, here is who played:\n{players_list_str}\n\nReply with the teams and score to update your Sync Rating! (e.g. 'Dave and I beat Sarah and Mike 6-4 6-2')"
    else:
        nudge_msg = f"🎾 {club_name}: Just a follow-up—did you get a result for the match on {match_time_str}?\n\nAs a reminder, here is who played:\n{players_list_str}\n\nReply back with the score so everyone's ratings stay accurate! 🎾"
    
    from twilio_client import send_sms
    if send_sms(player["phone_number"], nudge_msg, club_id=club_id):
        # Update match with nudge tracking
        new_count = nudge_count + 1
        supabase.table("matches").update({
            "result_nudge_count": new_count,
            "last_result_nudge_at": get_now_utc().isoformat()
        }).eq("match_id", match_id).execute()
        
        print(f"Sent result nudge #{new_count} to {player['name']} for match {match_id}")
        return 1
    return 0

def trigger_result_nudge_for_match(match_id: str):
    """Manually trigger a result nudge for a specific match."""
    result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not result.data:
        return {"error": "Match not found"}
    
    match = result.data[0]
    sent = send_result_nudge_for_match(match, is_manual=True)
    return {"match_id": match_id, "sms_sent": sent}

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
