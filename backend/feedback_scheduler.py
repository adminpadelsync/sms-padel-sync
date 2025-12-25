"""
Feedback Scheduler - Sends post-match feedback requests and reminders

Called by cron job: 
1. Checks for confirmed matches that started X hours ago and sends initial feedback requests
2. Checks for feedback requests sent Y hours ago with no response and sends reminders

Configurable per club:
- feedback_delay_hours: Hours after match start to send initial request (default: 3)
- feedback_reminder_delay_hours: Hours after initial request to send reminder (default: 4)
"""

from datetime import datetime, timedelta
from database import supabase
from logic_utils import get_club_settings, is_quiet_hours, get_club_timezone, parse_iso_datetime
import sms_constants as msg
from redis_client import get_redis_client
import json
import pytz
from twilio_client import send_sms


DEFAULT_FEEDBACK_DELAY_HOURS = 3.0
DEFAULT_REMINDER_DELAY_HOURS = 4.0
ASSUMED_MATCH_DURATION_HOURS = 1.5 # Padel matches are typically 90 mins


def get_matches_needing_feedback():
    """
    Find matches that started X hours ago and need initial feedback requests.
    Groups by club to respect per-club feedback delay settings and timezone.
    """
    matches_to_process = []
    
    # Get all clubs
    clubs_result = supabase.table("clubs").select("club_id, settings, timezone").eq("active", True).execute()
    
    for club in clubs_result.data:
        club_id = club["club_id"]
        settings = club.get("settings") or {}
        timezone_str = club.get("timezone") or "America/New_York"
        delay_hours = float(settings.get("feedback_delay_hours", DEFAULT_FEEDBACK_DELAY_HOURS))
        
        # Calculate the time window in the club's local time
        try:
            tz = pytz.timezone(timezone_str)
        except Exception:
            tz = pytz.timezone("America/New_York")
            
        # Get current local time and convert back to naive for comparison with DB
        now_local = datetime.now(tz).replace(tzinfo=None)
        # Delay is counted from match END, so add assumed duration to the offset
        cutoff_time = now_local - timedelta(hours=delay_hours + ASSUMED_MATCH_DURATION_HOURS)
        lookback_limit = now_local - timedelta(hours=48)
        
        # Query matches for this club
        result = supabase.table("matches").select("*").eq(
            "club_id", club_id
        ).eq(
            "status", "confirmed"
        ).eq(
            "feedback_collected", False
        ).gte(
            "scheduled_time", lookback_limit.isoformat()
        ).lte(
            "scheduled_time", cutoff_time.isoformat()
        ).execute()
        
        matches_to_process.extend(result.data)
    
    return matches_to_process



def get_requests_needing_reminder():
    """
    Find feedback requests that were sent X hours ago but have no response.
    Returns list of (request, match, player) tuples.
    """
    requests_to_remind = []
    
    # Get all clubs for their reminder settings and timezone
    clubs_result = supabase.table("clubs").select("club_id, settings, timezone").eq("active", True).execute()
    
    for club in clubs_result.data:
        club_id = club["club_id"]
        settings = club.get("settings") or {}
        timezone_str = club.get("timezone") or "America/New_York"
        reminder_hours = float(settings.get("feedback_reminder_delay_hours", DEFAULT_REMINDER_DELAY_HOURS))
        
        # Calculate timezone-aware cutoff times
        try:
            tz = pytz.timezone(timezone_str)
        except Exception:
            tz = pytz.timezone("America/New_York")
            
        # Requests are stored with UTC ISO strings usually, but let's check.
        # However, initial_sent_at is stored via datetime.utcnow().isoformat() in this file.
        # So for initial_sent_at, we SHOULD use utcnow().
        
        now_utc = datetime.utcnow()
        cutoff_time = now_utc - timedelta(hours=reminder_hours)
        lookback_limit = now_utc - timedelta(hours=48)
        
        # Find requests that need reminders for matches in this club
        # Note: we need to join with matches to filter by club_id
        result = supabase.table("feedback_requests").select(
            "*, matches!inner(*), players(*)"
        ).eq(
            "matches.club_id", club_id
        ).gte(
            "initial_sent_at", lookback_limit.isoformat()
        ).lte(
            "initial_sent_at", cutoff_time.isoformat()
        ).is_(
            "reminder_sent_at", "null"
        ).is_(
            "response_received_at", "null"
        ).execute()
        
        requests_to_remind.extend(result.data)
    
    return requests_to_remind



def send_feedback_requests_for_match(match: dict, is_manual_trigger: bool = False, force: bool = False):
    """
    Send feedback SMS to all players in a match.
    """
    match_id = match["match_id"]
    club_id = match.get("club_id")
    
    # Check quiet hours unless manually triggered
    if not is_manual_trigger and is_quiet_hours(club_id):
        return 0
    
    # Get all player IDs from both teams
    all_players = (match.get("team_1_players") or []) + (match.get("team_2_players") or [])
    all_players = [p for p in all_players if p]  # Filter nulls
    
    if len(all_players) != 4:
        print(f"Match {match_id} doesn't have 4 players, skipping feedback")
        return 0
    
    # Check if we already sent requests for this match
    existing = supabase.table("feedback_requests").select("player_id").eq(
        "match_id", match_id
    ).execute()
    existing_player_ids = {r["player_id"] for r in existing.data}
    
    # Get player details
    result = supabase.table("players").select(
        "player_id, name, phone_number"
    ).in_("player_id", all_players).execute()
    
    player_map = {p["player_id"]: p for p in result.data}
    
    sent_count = 0
    r = get_redis_client()
    
    for player_id in all_players:
        if player_id in existing_player_ids and not force:
            continue
            
        player = player_map.get(player_id)
        if not player:
            continue
            
        other_players = [player_map[pid] for pid in all_players if pid != player_id]
        if len(other_players) != 3:
            continue

        try:
            if player_id in existing_player_ids:
                if force:
                    supabase.table("feedback_requests").update({
                        "initial_sent_at": datetime.utcnow().isoformat(),
                        "reminder_sent_at": None,
                        "response_received_at": None
                    }).eq("match_id", match_id).eq("player_id", player_id).execute()
                else:
                    continue
            else:
                supabase.table("feedback_requests").insert({
                    "match_id": match_id,
                    "player_id": player_id,
                    "initial_sent_at": datetime.utcnow().isoformat()
                }).execute()
        except Exception as e:
            print(f"Skipping feedback for {player_id} in {match_id}: likely duplicate process ({e})")
            continue
        
        club_name = "the club"
        if club_id:
            club_res = supabase.table("clubs").select("name").eq("club_id", club_id).execute()
            if club_res.data:
                club_name = club_res.data[0]["name"]
        
        match_time = parse_iso_datetime(match["scheduled_time"])
        # Format: "Tuesday, Dec 23 @ 7pm"
        time_str = match_time.strftime("%A, %b %-d @ %-I:%M %p").replace(":00", "")
        
        message = msg.MSG_FEEDBACK_REQUEST.format(
            club_name=club_name,
            match_time=time_str,
            player1_name=other_players[0]["name"],
            player2_name=other_players[1]["name"],
            player3_name=other_players[2]["name"]
        )
        
        if r:
            key = f"user:{player['phone_number']}"
            state_data = {
                "state": msg.STATE_WAITING_FEEDBACK,
                "match_id": match_id,
                "players_to_rate": json.dumps([p["player_id"] for p in other_players])
            }
            for k, v in state_data.items():
                r.hset(key, k, v)
            r.expire(key, 86400)
        
        if send_sms(player["phone_number"], message):
            sent_count += 1
        else:
            print(f"Failed to send SMS to {player['phone_number']}, rolling back DB record")
            try:
                if not force:
                    supabase.table("feedback_requests").delete().eq("match_id", match_id).eq("player_id", player_id).execute()
            except Exception as e:
                print(f"Error rolling back feedback request: {e}")
    
    return sent_count


def send_reminder_for_request(request: dict):
    """Send a reminder SMS for a pending feedback request."""
    match = request.get("matches")
    player = request.get("players")
    
    if not match or not player:
        return False
        
    if is_quiet_hours(match.get("club_id")):
        return False
    
    match_id = match["match_id"]
    
    try:
        update_res = supabase.table("feedback_requests").update({
            "reminder_sent_at": datetime.utcnow().isoformat()
        }).eq("request_id", request["request_id"]).is_("reminder_sent_at", "null").execute()
        
        if not update_res.data:
            return False
            
    except Exception as e:
        print(f"Error claiming reminder for request {request['request_id']}: {e}")
        return False
    
    all_player_ids = (match.get("team_1_players") or []) + (match.get("team_2_players") or [])
    all_player_ids = [p for p in all_player_ids if p]
    
    result = supabase.table("players").select("player_id, name").in_(
        "player_id", all_player_ids
    ).execute()
    player_map = {p["player_id"]: p for p in result.data}
    
    other_players = [player_map[pid] for pid in all_player_ids if pid != player["player_id"]]
    if len(other_players) != 3:
        supabase.table("feedback_requests").update({"reminder_sent_at": None}).eq("request_id", request["request_id"]).execute()
        return False
    
    club_name = "the club"
    if match.get("club_id"):
        club_res = supabase.table("clubs").select("name").eq("club_id", match["club_id"]).execute()
        if club_res.data:
            club_name = club_res.data[0]["name"]
    
    match_time = parse_iso_datetime(match["scheduled_time"])
    # Format: "Tuesday, Dec 23 @ 7pm"
    time_str = match_time.strftime("%A, %b %-d @ %-I:%M %p").replace(":00", "")

    message = f"""🎾 {club_name}: Reminder - We'd love your feedback on your match on {time_str}!

On a scale of 1-10, how likely are you to play again with:

1. {other_players[0]["name"]}
2. {other_players[1]["name"]}
3. {other_players[2]["name"]}

Reply with 3 numbers (e.g., "8 7 9") or SKIP"""
    
    r = get_redis_client()
    if r:
        key = f"user:{player['phone_number']}"
        state_data = {
            "state": msg.STATE_WAITING_FEEDBACK,
            "match_id": match_id,
            "players_to_rate": json.dumps([p["player_id"] for p in other_players])
        }
        for k, v in state_data.items():
            r.hset(key, k, v)
        r.expire(key, 86400)
    
    if send_sms(player["phone_number"], message):
        return True
    else:
        print(f"Failed to send reminder SMS to {player['phone_number']}, reverting claim")
        supabase.table("feedback_requests").update({"reminder_sent_at": None}).eq("request_id", request["request_id"]).execute()
        return False


def run_feedback_scheduler():
    """Main entry point for cron job."""
    matches = get_matches_needing_feedback()
    initial_sent = 0
    for match in matches:
        initial_sent += send_feedback_requests_for_match(match)
    
    requests = get_requests_needing_reminder()
    reminders_sent = 0
    for request in requests:
        if send_reminder_for_request(request):
            reminders_sent += 1
        
    return {
        "matches_processed": len(matches),
        "initial_sms_sent": initial_sent,
        "reminders_sent": reminders_sent
    }


def trigger_feedback_for_match(match_id: str, force: bool = False):
    """Manually trigger feedback requests for a specific match."""
    result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    if not result.data:
        return {"error": "Match not found"}
    
    match = result.data[0]
    sent = send_feedback_requests_for_match(match, is_manual_trigger=True, force=force)
    return {"match_id": match_id, "sms_sent": sent}
