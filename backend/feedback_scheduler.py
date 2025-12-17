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
from twilio_client import send_sms
import sms_constants as msg
from redis_client import get_redis_client
import json

DEFAULT_FEEDBACK_DELAY_HOURS = 3.0
DEFAULT_REMINDER_DELAY_HOURS = 4.0


def get_club_settings(club_id: str) -> dict:
    """Get feedback settings for a club."""
    try:
        result = supabase.table("clubs").select("settings").eq("club_id", club_id).execute()
        if result.data and result.data[0].get("settings"):
            return result.data[0]["settings"]
    except Exception as e:
        print(f"Error getting club settings: {e}")
    return {}


def get_matches_needing_feedback():
    """
    Find matches that started X hours ago and need initial feedback requests.
    Groups by club to respect per-club feedback delay settings.
    """
    matches_to_process = []
    
    # Get all clubs
    clubs_result = supabase.table("clubs").select("club_id, settings").eq("active", True).execute()
    
    for club in clubs_result.data:
        club_id = club["club_id"]
        settings = club.get("settings") or {}
        delay_hours = float(settings.get("feedback_delay_hours", DEFAULT_FEEDBACK_DELAY_HOURS))
        
        # Calculate the time window
        # We look for ANY match that started at least delay_hours ago, but not older than 48h
        # This handles cases where the cron job missed its slot or downtime occurred.
        
        now = datetime.utcnow()
        cutoff_time = now - timedelta(hours=delay_hours)
        lookback_limit = now - timedelta(hours=48)
        
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
    
    # Get all clubs for their reminder settings
    clubs_result = supabase.table("clubs").select("club_id, settings").eq("active", True).execute()
    
    for club in clubs_result.data:
        club_id = club["club_id"]
        settings = club.get("settings") or {}
        reminder_hours = float(settings.get("feedback_reminder_delay_hours", DEFAULT_REMINDER_DELAY_HOURS))
        
        # Find requests that need reminders
        # Widen window to catch missed crons
        now = datetime.utcnow()
        cutoff_time = now - timedelta(hours=reminder_hours)
        lookback_limit = now - timedelta(hours=48)
        
        # Get requests where:
        # 1. Initial sent at least reminder_hours ago (but not ancient)
        # 2. No reminder sent yet
        # 3. No response received yet
        result = supabase.table("feedback_requests").select(
            "*, matches(*), players(*)"
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
    
    Args:
        match: Match dictionary
        is_manual_trigger: If True, skip time checks and send immediately
        force: If True, resend even if already sent
    """
    match_id = match["match_id"]
    
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
        # Skip if already sent AND not forcing
        if player_id in existing_player_ids and not force:
            continue
            
        player = player_map.get(player_id)
        if not player:
            continue
            
        # Get the other 3 players for this player to rate
        other_players = [player_map[pid] for pid in all_players if pid != player_id]
        
        if len(other_players) != 3:
            continue
        
        # Get club name for the message
        club_name = "the club"
        if match.get("club_id"):
            club_res = supabase.table("clubs").select("name").eq("club_id", match["club_id"]).execute()
            if club_res.data:
                club_name = club_res.data[0]["name"]
        
        # Format friendly match time (e.g. "Mon 6pm")
        match_time = datetime.fromisoformat(match["scheduled_time"])
        time_str = match_time.strftime("%a %-I%p").replace(":00", "").lower()
        
        # Format message with player names
        message = msg.MSG_FEEDBACK_REQUEST.format(
            club_name=club_name,
            match_time=time_str,
            player1_name=other_players[0]["name"],
            player2_name=other_players[1]["name"],
            player3_name=other_players[2]["name"]
        )
        
        # Set user state for handling their response
        if r:
            key = f"user:{player['phone_number']}"
            state_data = {
                "state": msg.STATE_WAITING_FEEDBACK,
                "match_id": match_id,
                "players_to_rate": json.dumps([p["player_id"] for p in other_players])
            }
            for k, v in state_data.items():
                r.hset(key, k, v)
            r.expire(key, 86400)  # 24 hour expiry for feedback responses
        
        # Send SMS
        if send_sms(player["phone_number"], message):
            # Record or Update the request
            if player_id in existing_player_ids:
                # Update existing to reset lifecycle
                supabase.table("feedback_requests").update({
                    "initial_sent_at": datetime.utcnow().isoformat(),
                    "reminder_sent_at": None,
                    "response_received_at": None
                }).eq("match_id", match_id).eq("player_id", player_id).execute()
            else:
                # Insert new
                supabase.table("feedback_requests").insert({
                    "match_id": match_id,
                    "player_id": player_id,
                    "initial_sent_at": datetime.utcnow().isoformat()
                }).execute()
                
            sent_count += 1
    
    return sent_count


def send_reminder_for_request(request: dict):
    """Send a reminder SMS for a pending feedback request."""
    match = request.get("matches")
    player = request.get("players")
    
    if not match or not player:
        return False
    
    match_id = match["match_id"]
    
    # Get all players in match for context
    all_player_ids = (match.get("team_1_players") or []) + (match.get("team_2_players") or [])
    all_player_ids = [p for p in all_player_ids if p]
    
    result = supabase.table("players").select("player_id, name").in_(
        "player_id", all_player_ids
    ).execute()
    player_map = {p["player_id"]: p for p in result.data}
    
    # Get the other 3 players for this player to rate
    other_players = [player_map[pid] for pid in all_player_ids if pid != player["player_id"]]
    
    if len(other_players) != 3:
        return False
    
    # Get club name for the message
    club_name = "the club"
    if match.get("club_id"):
        club_res = supabase.table("clubs").select("name").eq("club_id", match["club_id"]).execute()
        if club_res.data:
            club_name = club_res.data[0]["name"]
    
    # Format friendly match time
    match_time = datetime.fromisoformat(match["scheduled_time"])
    time_str = match_time.strftime("%a %-I%p").replace(":00", "").lower()

    # Send reminder with slightly different wording
    message = f"""🎾 {club_name}: Reminder - We'd love your feedback on your match on {time_str}!

On a scale of 1-10, how likely are you to play again with:

1. {other_players[0]["name"]}
2. {other_players[1]["name"]}
3. {other_players[2]["name"]}

Reply with 3 numbers (e.g., "8 7 9") or SKIP"""
    
    # Update user state
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
        # Mark reminder as sent
        supabase.table("feedback_requests").update({
            "reminder_sent_at": datetime.utcnow().isoformat()
        }).eq("request_id", request["request_id"]).execute()
        return True
    
    return False


def run_feedback_scheduler():
    """Main entry point for cron job - handles both initial requests and reminders."""
    # 1. Send initial feedback requests for new matches
    matches = get_matches_needing_feedback()
    
    initial_sent = 0
    for match in matches:
        sent = send_feedback_requests_for_match(match)
        initial_sent += sent
    
    # 2. Send reminders for pending requests
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
    """
    Manually trigger feedback requests for a specific match.
    Used for testing from the SMS simulator.
    """
    result = supabase.table("matches").select("*").eq("match_id", match_id).execute()
    
    if not result.data:
        return {"error": "Match not found"}
    
    match = result.data[0]
    sent = send_feedback_requests_for_match(match, is_manual_trigger=True, force=force)
    
    return {
        "match_id": match_id,
        "sms_sent": sent
    }
