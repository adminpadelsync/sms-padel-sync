"""Handler for feedback SMS responses."""

from typing import Optional, List
from database import supabase
from twilio_client import send_sms
import sms_constants as msg
from redis_client import clear_user_state
import re
import json
from logic_utils import get_now_utc


def handle_feedback_response(from_number: str, body: str, player: dict, state_data: dict, cid: str = None):
    """
    Handle a feedback rating response.
    
    Expected format: "8 7 9" (three numbers 1-10 separated by spaces)
    """
    body = body.strip().upper()
    
    # Check for skip
    if body == "SKIP":
        clear_user_state(from_number)
        send_sms(from_number, msg.MSG_FEEDBACK_SKIPPED, club_id=cid or player.get("club_id"))
        return
    
    # Parse ratings
    ratings = parse_ratings(body)
    
    if ratings is None:
        send_sms(from_number, msg.MSG_FEEDBACK_INVALID, club_id=cid or player.get("club_id"))
        return
    
    # Get players to rate from state (stored as JSON string or list)
    players_to_rate_data = state_data.get("players_to_rate", [])
    
    if isinstance(players_to_rate_data, str):
        try:
            players_to_rate = json.loads(players_to_rate_data)
        except json.JSONDecodeError:
            players_to_rate = []
    elif isinstance(players_to_rate_data, list):
        players_to_rate = players_to_rate_data
    else:
        players_to_rate = []
    
    match_id = state_data.get("match_id")
    
    if len(ratings) != len(players_to_rate) or len(ratings) != 3:
        send_sms(from_number, msg.MSG_FEEDBACK_INVALID, club_id=cid or player.get("club_id"))
        return
    
    # Build ratings dict: {player_id: score}
    individual_ratings = {
        player_id: score 
        for player_id, score in zip(players_to_rate, ratings)
    }
    
    # Save feedback
    save_feedback(
        match_id=match_id,
        player_id=player["player_id"],
        individual_ratings=individual_ratings
    )
    
    # Update compatibility scores
    update_compatibility_scores(player["player_id"], individual_ratings)
    
    # Clear state and thank player
    clear_user_state(from_number)
    send_sms(from_number, msg.MSG_FEEDBACK_THANKS, club_id=cid or player.get("club_id"))


def parse_ratings(body: str) -> Optional[List[int]]:
    """Parse space-separated ratings from message body."""
    # Match 3 numbers separated by spaces or commas
    parts = re.split(r'[\s,]+', body.strip())
    
    if len(parts) != 3:
        return None
    
    ratings = []
    for part in parts:
        try:
            score = int(part)
            if score < 1 or score > 10:
                return None
            ratings.append(score)
        except ValueError:
            return None
    
    return ratings


def save_feedback(match_id: str, player_id: str, individual_ratings: dict):
    """Save or update feedback record."""
    
    # Check if feedback already exists
    existing = supabase.table("match_feedback").select("feedback_id").eq(
        "match_id", match_id
    ).eq(
        "player_id", player_id
    ).execute()
    
    if existing.data:
        # Update existing
        supabase.table("match_feedback").update({
            "individual_ratings": individual_ratings
        }).eq("feedback_id", existing.data[0]["feedback_id"]).execute()
    else:
        # Create new
        supabase.table("match_feedback").insert({
            "match_id": match_id,
            "player_id": player_id,
            "individual_ratings": individual_ratings
        }).execute()
    
    # Mark the feedback request as received (for reminder tracking)
    mark_feedback_received(match_id, player_id)
    
    # Check if all 4 players have submitted feedback
    check_and_mark_feedback_complete(match_id)


def mark_feedback_received(match_id: str, player_id: str):
    """Mark a feedback request as having received a response."""
    try:
        supabase.table("feedback_requests").update({
            "response_received_at": get_now_utc().isoformat()
        }).eq("match_id", match_id).eq("player_id", player_id).execute()
    except Exception as e:
        # Non-critical, just log it
        print(f"Error marking feedback received: {e}")


def check_and_mark_feedback_complete(match_id: str):
    """Mark match as feedback_collected if all players submitted."""
    feedback_result = supabase.table("match_feedback").select(
        "feedback_id"
    ).eq("match_id", match_id).not_.is_(
        "individual_ratings", "null"
    ).execute()
    
    if len(feedback_result.data) >= 4:
        supabase.table("matches").update({
            "feedback_collected": True
        }).eq("match_id", match_id).execute()


def update_compatibility_scores(rater_id: str, ratings: dict):
    """
    Update player_compatibility table based on new ratings.
    
    NPS interpretation: 7+ = would play again (promoter/passive)
    """
    
    for rated_id, score in ratings.items():
        # Ensure consistent ordering (lower ID first for the pair)
        if rater_id < rated_id:
            p1, p2 = rater_id, rated_id
        else:
            p1, p2 = rated_id, rater_id
        
        # Get existing record
        existing = supabase.table("player_compatibility").select("*").eq(
            "player_1_id", p1
        ).eq(
            "player_2_id", p2
        ).execute()
        
        # NPS interpretation: 7-10 = would play again, 1-6 = would not
        would_play_again = score >= 7
        
        if existing.data:
            record = existing.data[0]
            new_count_yes = record["would_play_again_count"] + (1 if would_play_again else 0)
            new_count_no = record["would_not_play_again_count"] + (0 if would_play_again else 1)
            total = new_count_yes + new_count_no
            
            # Calculate new compatibility score (0-100)
            new_score = int((new_count_yes / total) * 100) if total > 0 else 50
            
            supabase.table("player_compatibility").update({
                "would_play_again_count": new_count_yes,
                "would_not_play_again_count": new_count_no,
                "compatibility_score": new_score,
                "last_updated": "now()"
            }).eq("player_1_id", p1).eq("player_2_id", p2).execute()
        else:
            # Create new record
            supabase.table("player_compatibility").insert({
                "player_1_id": p1,
                "player_2_id": p2,
                "would_play_again_count": 1 if would_play_again else 0,
                "would_not_play_again_count": 0 if would_play_again else 1,
                "compatibility_score": 100 if would_play_again else 0,
                "last_match_together": "now()"
            }).execute()
