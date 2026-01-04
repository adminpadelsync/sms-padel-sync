from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from logic_utils import parse_iso_datetime, get_now_utc, to_utc_iso
import sms_constants as msg
from database import supabase
from match_organizer import (
    get_player_recommendations, 
    initiate_match_outreach,
    get_match_details,
    get_match_invites,
    send_match_invites,
    update_match,
    add_player_to_match,
    remove_player_from_match
)
from handlers.match_handler import notify_players_of_booking

router = APIRouter()

from logic.elo_service import update_match_elo
from result_nudge_scheduler import run_result_nudge_scheduler
import twilio_manager

class RecommendationRequest(BaseModel):
    club_id: str
    target_level: float
    gender_preference: Optional[str] = None
    exclude_player_ids: List[str] = []

class OutreachRequest(BaseModel):
    club_id: str
    player_ids: List[str]
    scheduled_time: str
    initial_player_ids: List[str] = []  # Players already committed to the match

class MatchUpdateRequest(BaseModel):
    scheduled_time: Optional[str] = None
    status: Optional[str] = None
    score_text: Optional[str] = None
    winner_team: Optional[int] = None
    court_booked: Optional[bool] = None
    booked_court_text: Optional[str] = None
    notify_players: Optional[bool] = False
    team_1_players: Optional[List[str]] = None
    team_2_players: Optional[List[str]] = None

class AddPlayerRequest(BaseModel):
    player_id: str
    team: int  # 1 or 2

class SendInvitesRequest(BaseModel):
    player_ids: List[str]

class AssessmentResultRequest(BaseModel):
    player_name: Optional[str] = None
    responses: Dict[str, Any]
    rating: float
    breakdown: Optional[Dict[str, Any]] = None

class BulkMatchDeleteRequest(BaseModel):
    match_ids: List[str]

class BookingMarkRequest(BaseModel):
    user_id: str
    court_text: Optional[str] = None

class AssessmentUpdate(BaseModel):
    player_name: str

class CreateConfirmedMatchRequest(BaseModel):
    player_ids: List[str]
    club_id: str
    scheduled_time: Optional[str] = None

@router.get("/clubs")
async def get_clubs():
    """Get all active clubs."""

    try:
        result = supabase.table("clubs").select("*").eq("active", True).execute()
        return {"clubs": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateClubRequest(BaseModel):
    name: str
    phone_number: str
    court_count: int = 4
    address: Optional[str] = None
    poc_name: Optional[str] = None
    poc_phone: Optional[str] = None
    main_phone: Optional[str] = None
    booking_system: Optional[str] = None
    booking_slug: Optional[str] = None

class ClubUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    poc_name: Optional[str] = None
    poc_phone: Optional[str] = None
    main_phone: Optional[str] = None
    booking_system: Optional[str] = None
    booking_slug: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/clubs")
async def create_club(request: CreateClubRequest):
    """Create a new club and its courts."""
    try:
        # 1. Create Club
        club_data = {
            "name": request.name,
            "phone_number": request.phone_number,
            "court_count": request.court_count,
            "address": request.address,
            "poc_name": request.poc_name,
            "poc_phone": request.poc_phone,
            "main_phone": request.main_phone,
            "booking_system": request.booking_system,
            "booking_slug": request.booking_slug,
            "active": True
        }
        
        result = supabase.table("clubs").insert(club_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create club")
        
        new_club = result.data[0]
        club_id = new_club["club_id"]
        
        # 2. Create Courts
        courts_data = []
        for i in range(request.court_count):
            courts_data.append({
                "club_id": club_id,
                "name": f"Court {i+1}",
                "settings": {}
            })
            
        if courts_data:
            supabase.table("courts").insert(courts_data).execute()
            
        return {"club": new_club, "message": f"Club created with {request.court_count} courts"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Club Twilio Provisioning ---

@router.get("/clubs/available-numbers")
async def get_club_available_numbers(area_code: str = "305"):
    """Search for available Twilio numbers by area code."""
    try:
        numbers = twilio_manager.search_available_numbers(area_code)
        return {"numbers": numbers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/clubs/{club_id}")
async def get_club(club_id: str):
    """Get a single club by ID."""
    try:
        result = supabase.table("clubs").select("*").eq("club_id", club_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Club not found")
        return {"club": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/clubs/{club_id}")
async def update_club(club_id: str, updates: ClubUpdate):
    """Update club fields (name, phone_number)."""

    try:
        # Build updates dict from non-None fields
        update_data = {}
        if updates.name is not None:
            update_data["name"] = updates.name
        if updates.phone_number is not None:
            update_data["phone_number"] = updates.phone_number
        if updates.address is not None:
            update_data["address"] = updates.address
        if updates.poc_name is not None:
            update_data["poc_name"] = updates.poc_name
        if updates.poc_phone is not None:
            update_data["poc_phone"] = updates.poc_phone
        if updates.main_phone is not None:
            update_data["main_phone"] = updates.main_phone
        if updates.booking_system is not None:
            update_data["booking_system"] = updates.booking_system
        if updates.booking_slug is not None:
            update_data["booking_slug"] = updates.booking_slug
        if updates.timezone is not None:
            update_data["timezone"] = updates.timezone

        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update the club
        result = supabase.table("clubs").update(update_data).eq("club_id", club_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Club not found")
        
        return {"club": result.data[0], "message": "Club updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clubs/{club_id}")
async def delete_club(club_id: str):
    """
    Delete a club and all its associated data.
    This includes releasing Twilio numbers for the club and all its groups,
    and deleting courts, matches, invites, feedback, and groups.
    """
    print(f"[DELETE_CLUB] Starting deletion for club_id: {club_id}")
    logs = []
    
    def add_log(step, status, message):
        logs.append({"step": step, "status": status, "message": message, "timestamp": datetime.now().isoformat()})
        print(f"[{status.upper()}] {step}: {message}")

    try:
        # 0. Release Twilio Numbers
        # 0a. Release Club Number
        step = "Release Club Twilio Number"
        try:
            success, msg = twilio_manager.release_club_number(club_id)
            if success:
                add_log(step, "success", msg)
            else:
                # If "No active number found", we treat as success/info rather than failure
                if "No active number found" in msg:
                    add_log(step, "success", "No active number was provisioned to this club.")
                else:
                    add_log(step, "warning", msg)
        except Exception as e:
            add_log(step, "error", f"Failed to release: {str(e)}")

        # 0b. Release Group Numbers
        step = "Release Group Twilio Numbers"
        try:
            groups_res = supabase.table("player_groups").select("group_id, name").eq("club_id", club_id).execute()
            groups = groups_res.data or []
            if not groups:
                add_log(step, "success", "No player groups found for this club.")
            else:
                for group in groups:
                    g_step = f"Release Number for Group: {group.get('name', group['group_id'])}"
                    g_success, g_msg = twilio_manager.release_group_number(group["group_id"])
                    add_log(g_step, "success" if g_success else "warning", g_msg)
                add_log(step, "success", f"Processed {len(groups)} group numbers.")
        except Exception as e:
            add_log(step, "error", f"Failed to process group numbers: {str(e)}")

        # 1. Get matches associated with this club
        step = "Fetch Matches"
        matches_res = supabase.table("matches").select("match_id").eq("club_id", club_id).execute()
        match_ids = [m["match_id"] for m in (matches_res.data or [])]
        add_log(step, "success", f"Found {len(match_ids)} matches associated with this club.")

        if match_ids:
            # 2. Delete match feedback
            step = "Delete Match Feedback"
            supabase.table("match_feedback").delete().in_("match_id", match_ids).execute()
            add_log(step, "success", "Deleted all match feedback.")
            
            # 3. Delete match invites
            step = "Delete Match Invites"
            supabase.table("match_invites").delete().in_("match_id", match_ids).execute()
            add_log(step, "success", "Deleted all match invites.")

            # 4. Delete feedback requests
            step = "Delete Feedback Requests"
            supabase.table("feedback_requests").delete().in_("match_id", match_ids).execute()
            add_log(step, "success", "Deleted all feedback requests.")
            
            # 5. Delete rating history associated with these matches
            step = "Delete Rating History"
            supabase.table("player_rating_history").delete().in_("match_id", match_ids).execute()
            add_log(step, "success", "Deleted associated rating history.")

            # 6. Delete matches
            step = "Delete Matches"
            supabase.table("matches").delete().eq("club_id", club_id).execute()
            add_log(step, "success", "Deleted all match records.")

        # 6. Delete player groups (group_memberships should cascade)
        step = "Delete Player Groups"
        supabase.table("player_groups").delete().eq("club_id", club_id).execute()
        add_log(step, "success", "Deleted all player groups.")

        # 7. Delete courts
        step = "Delete Courts"
        supabase.table("courts").delete().eq("club_id", club_id).execute()
        add_log(step, "success", "Deleted all court records.")

        # 8. Delete error logs
        step = "Delete Error Logs"
        supabase.table("error_logs").delete().eq("club_id", club_id).execute()
        add_log(step, "success", "Deleted all error logs for this club.")

        # 9. Finally, delete the club (club_members should cascade)
        step = "Delete Club Record"
        result = supabase.table("clubs").delete().eq("club_id", club_id).execute()
        
        if not result.data:
            add_log(step, "error", "Club record not found during final deletion phase.")
            raise HTTPException(status_code=404, detail="Club not found")

        add_log(step, "success", "Successfully removed the club record from the database.")
        
        return {
            "message": "Club and all associated data deleted successfully",
            "logs": logs
        }

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        add_log("Critical Error", "error", err_msg)
        print(f"[DELETE_CLUB] CRITICAL ERROR: {err_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=err_msg, headers={"X-Deletion-Logs": str(logs)})


@router.get("/players")
async def get_players(request: Request):
    """Get all players, optionally filtered by club."""

    try:
        # Get club_id from query params directly for robustness
        club_id = request.query_params.get("club_id") or request.query_params.get("cid")
        print(f"DEBUG: get_players explicitly called with club_id={club_id}")
        
        query = supabase.table("players").select(
            "player_id, name, phone_number, declared_skill_level, gender, active_status, pro_verified, responsiveness_score, reputation_score, total_matches_played"
        )
        
        if club_id and club_id.strip() and club_id != "undefined" and club_id != "null":
            print(f"DEBUG: Applying club_id filter via club_members: {club_id}")
            members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
            member_ids = [m["player_id"] for m in (members_res.data or [])]
            query = query.in_("player_id", member_ids)
        
        result = query.eq("active_status", True).order("name").execute()
        players = result.data or []
        print(f"DEBUG: Found {len(players)} players")
        return {"players": players}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/{player_id}/rating-history")
async def get_player_rating_history(player_id: str):
    """Get the rating history for a specific player."""

    try:
        # Join with matches to get the actual match date and scores
        result = supabase.table("player_rating_history")\
            .select("*, matches(scheduled_time, score_text, club_id)")\
            .eq("player_id", player_id)\
            .order("created_at", desc=True).execute()
        return {"history": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/{player_id}/feedback-summary")
async def get_player_feedback_summary(player_id: str):
    """
    Get aggregate feedback metrics for a specific player.
    Lifetime average rating and "Play Again" percentage.
    """

    try:
        # Get matches where the player was a participant
        matches_res = supabase.table("matches").select("match_id").or_(
            f"team_1_players.cs.{{{player_id}}},team_2_players.cs.{{{player_id}}}"
        ).execute()
        
        match_ids = [m["match_id"] for m in (matches_res.data or [])]
        if not match_ids:
            return {
                "avg_rating": 0,
                "play_again_pct": 0,
                "total_reviews": 0
            }
            
        # Fetch feedback for these matches
        # Feedback where this player was NOT the rater (someone else rated them)
        feedback_res = supabase.table("match_feedback").select("individual_ratings").in_("match_id", match_ids).neq("player_id", player_id).execute()
        
        ratings = []
        play_again_count = 0
        
        for fb in (feedback_res.data or []):
            i_ratings = fb.get("individual_ratings") or {}
            if player_id in i_ratings:
                score = i_ratings[player_id]
                ratings.append(score)
                if score >= 7:
                    play_again_count += 1
        
        total_reviews = len(ratings)
        avg_rating = round(sum(ratings) / total_reviews, 1) if total_reviews > 0 else 0
        play_again_pct = round((play_again_count / total_reviews) * 100) if total_reviews > 0 else 0
        
        return {
            "avg_rating": avg_rating,
            "play_again_pct": play_again_pct,
            "total_reviews": total_reviews
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clubs/{club_id}/rankings")
async def get_club_rankings(club_id: str):


    try:
        # 1. Fetch player IDs for this club
        members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
        member_ids = [m["player_id"] for m in (members_res.data or [])]
        
        if not member_ids:
            return {"rankings": []}

        # 2. Fetch data for these players
        result = supabase.table("players").select(
            "player_id, name, elo_rating, elo_confidence, adjusted_skill_level, gender"
        ).in_("player_id", member_ids).eq("active_status", True).order("elo_rating", desc=True).execute()
        return {"rankings": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendations")
async def get_recommendations(request: RecommendationRequest):
    try:
        players = get_player_recommendations(
            club_id=request.club_id,
            target_level=request.target_level,
            gender_preference=request.gender_preference,
            exclude_player_ids=request.exclude_player_ids
        )
        return {"players": players}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/search")
async def search_players(club_id: str, q: str = ""):


    try:
        # 1. Fetch player IDs for this club
        members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
        member_ids = [m["player_id"] for m in (members_res.data or [])]
        
        if not member_ids:
            return {"players": []}

        # 2. Search within these players
        query = supabase.table("players").select(
            "player_id, name, phone_number, declared_skill_level, gender"
        ).in_("player_id", member_ids).eq("active_status", True)
        
        if q:
            query = query.ilike("name", f"%{q}%")
        
        result = query.order("name").limit(20).execute()
        return {"players": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/outreach")
async def create_outreach(request: OutreachRequest):
    from fastapi.responses import JSONResponse
    import traceback
    print("DEBUG: Entered create_outreach handler")
    print(f"DEBUG: Request payload: {request}")
    try:
        match = initiate_match_outreach(
            club_id=request.club_id,
            player_ids=request.player_ids,
            scheduled_time=request.scheduled_time,
            initial_player_ids=request.initial_player_ids
        )
        return {"match": match, "message": "Outreach initiated successfully"}
    except Exception as e:
        print(f"DEBUG: Exception in create_outreach: {e}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Backend Error: {str(e)}",
                "traceback": traceback.format_exc()
            }
        )

@router.get("/clubs/{club_id}/matches/booking-status")
async def get_club_booking_status(club_id: str):


    try:
        # 1. Fetch future confirmed or pending matches
        # Note: we want confirmed matches primarily, but maybe also pending if the club wants to see them.
        # User said: "matches (that are in the future) listing the matches without courts booked at the top"
        # We'll filter for status in ('confirmed', 'pending')
        
        now = get_now_utc().isoformat()
        
        query = supabase.table("matches").select(
            "*, originator:originator_id(name, phone_number, declared_skill_level)"
        ).eq("club_id", club_id)\
         .gte("scheduled_time", now)\
         .in_("status", ["confirmed", "pending"])\
         .order("court_booked", desc=False)\
         .order("scheduled_time", desc=False)
        
        result = query.execute()
        matches = result.data or []
        
        # 2. Enrich with player details (name, level, phone)
        # We need to fetch all players involved in these matches
        player_ids = set()
        for m in matches:
            if m.get("team_1_players"):
                player_ids.update(m["team_1_players"])
            if m.get("team_2_players"):
                player_ids.update(m["team_2_players"])
        
        player_map = {}
        if player_ids:
            players_res = supabase.table("players").select(
                "player_id, name, phone_number, declared_skill_level"
            ).in_("player_id", list(player_ids)).execute()
            player_map = {p["player_id"]: p for p in players_res.data}
        
        # Add enriched player details to each match
        for m in matches:
            m["team_1_details"] = [player_map.get(pid) for pid in (m.get("team_1_players") or []) if pid in player_map]
            m["team_2_details"] = [player_map.get(pid) for pid in (m.get("team_2_players") or []) if pid in player_map]
            
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/matches/{match_id}/mark-booked")
async def mark_match_booked(match_id: str, request: BookingMarkRequest):


    import uuid
    try:
        now = get_now_utc().isoformat()
        update_data = {
            "court_booked": True,
            "booked_at": now,
            "booked_court_text": request.court_text
        }
        
        # Only set booked_by if it's a valid UUID
        try:
            uuid.UUID(request.user_id)
            update_data["booked_by"] = request.user_id
        except (ValueError, TypeError):
            pass
        
        result = supabase.table("matches").update(update_data).eq("match_id", match_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Trigger SMS notification if court text was provided
        if request.court_text:
            try:
                notify_players_of_booking(match_id, request.court_text)
            except Exception as e:
                print(f"[ERROR] Failed to send booking notification: {e}")
            
        return {"match": result.data[0], "message": "Match marked as booked"}
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "column" in error_msg.lower() and "not find" in error_msg.lower():
            error_msg = "Database column missing. Please run the SQL migration 016_add_match_booking_fields.sql in Supabase."
        raise HTTPException(status_code=500, detail=error_msg)

# IMPORTANT: This route MUST come before /matches/{match_id} or "confirmed" gets treated as a match_id
@router.get("/matches/confirmed")
async def get_confirmed_matches(club_id: str = None):


    try:
        # Query matches that are confirmed OR have 4 players
        query = supabase.table("matches").select(
            "match_id, scheduled_time, status, team_1_players, team_2_players, feedback_collected, club_id"
        )
        
        if club_id:
            query = query.eq("club_id", club_id)
        
        # Get confirmed matches or matches with players
        result = query.in_("status", ["confirmed", "pending"]).order(
            "scheduled_time", desc=True
        ).limit(30).execute()
        
        matches = result.data or []
        
        # Filter to only matches with 4 players (for feedback eligibility)
        matches = [
            m for m in matches 
            if len((m.get("team_1_players") or []) + (m.get("team_2_players") or [])) == 4
            or m.get("status") == "confirmed"
        ][:20]  # Limit after filtering
        
        # Get player names for each match
        all_player_ids = set()
        for match in matches:
            for pid in (match.get("team_1_players") or []) + (match.get("team_2_players") or []):
                if pid:
                    all_player_ids.add(pid)
        
        if all_player_ids:
            players_result = supabase.table("players").select(
                "player_id, name"
            ).in_("player_id", list(all_player_ids)).execute()
            player_map = {p["player_id"]: p["name"] for p in players_result.data}
            
            # Add player names to matches
            for match in matches:
                match["player_names"] = []
                for pid in (match.get("team_1_players") or []) + (match.get("team_2_players") or []):
                    if pid and pid in player_map:
                        match["player_names"].append(player_map[pid])
        
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/{match_id}")
async def get_match(match_id: str):
    """Get detailed match information including player names."""
    try:
        match = get_match_details(match_id)
        return {"match": match}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/matches/{match_id}/invites")
async def get_invites(match_id: str):
    """Get all invites for a match with player details and status."""
    try:
        invites = get_match_invites(match_id)
        return {"invites": invites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/matches/{match_id}/invites")
async def send_invites(match_id: str, request: SendInvitesRequest):
    """Send invites to additional players for an existing match."""
    try:
        invites = send_match_invites(match_id, request.player_ids)
        return {"invites": invites, "message": f"Sent {len(invites)} invite(s)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/matches/{match_id}")
async def update_match_endpoint(match_id: str, request: MatchUpdateRequest):
    """Update match fields like scheduled_time or status."""
    try:
        # Build updates dict from non-None fields
        updates = {}
        if request.scheduled_time is not None:
            # Need club_id for correct TZ conversion
            m_res = supabase.table("matches").select("club_id").eq("match_id", match_id).execute()
            cid = m_res.data[0]["club_id"] if m_res.data else None
            updates['scheduled_time'] = to_utc_iso(request.scheduled_time, cid)
        if request.status is not None:
            updates['status'] = request.status
        if request.score_text is not None:
            updates['score_text'] = request.score_text
        if request.winner_team is not None:
            updates['winner_team'] = request.winner_team
        if request.court_booked is not None:
            updates['court_booked'] = request.court_booked
        if request.booked_court_text is not None:
            updates['booked_court_text'] = request.booked_court_text
        if request.team_1_players is not None:
            updates['team_1_players'] = request.team_1_players
        if request.team_2_players is not None:
            updates['team_2_players'] = request.team_2_players
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        match = update_match(match_id, updates)
        
        # Trigger SMS notification if requested
        if request.notify_players and request.booked_court_text:
            try:
                notify_players_of_booking(match_id, request.booked_court_text)
            except Exception as notify_err:
                print(f"Error notifying players of booking: {notify_err}")

        # Trigger Elo update if result is set or changed
        if (updates.get('status') == 'completed' or 'winner_team' in updates) and match.get('winner_team'):
            try:
                update_match_elo(match_id, int(match['winner_team']))
            except Exception as elo_err:
                print(f"Error updating Elo after match update: {elo_err}")
                # We don't fail the whole request if Elo fails, but we log it
        
        return {"match": match, "message": "Match updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/matches/{match_id}/players")
async def add_player(match_id: str, request: AddPlayerRequest):
    """Add a player to a match team."""
    try:
        match = add_player_to_match(match_id, request.player_id, request.team)
        return {"match": match, "message": "Player added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/matches/{match_id}/players/{player_id}")
async def remove_player(match_id: str, player_id: str):
    """Remove a player from a match."""
    try:
        match = remove_player_from_match(match_id, player_id)
        return {"match": match, "message": "Player removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.api_route("/cron/feedback", methods=["GET", "POST"])
async def trigger_feedback_collection():
    """Cron endpoint to send feedback requests for recent matches."""
    from feedback_scheduler import run_feedback_scheduler
    try:
        result = run_feedback_scheduler()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.api_route("/cron/result-nudges", methods=["GET", "POST"])
async def trigger_result_nudges():
    """Cron endpoint to send result nudges to match originators."""
    try:
        result = run_result_nudge_scheduler()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.api_route("/cron/invite-timeout", methods=["GET", "POST"])
async def process_invite_timeouts():
    """Cron endpoint to process batch refills and send replacements."""
    from matchmaker import process_batch_refills, process_pending_matches
    try:
        # 1. Process batch refills (next batch logic)
        new_invites = process_batch_refills()
        
        # 2. Process pending matches with no active invites (catch-up logic)
        catch_up_invites = process_pending_matches()
        
        return {
            "message": f"Processed invites: {new_invites} batch refills, {catch_up_invites} catch-up invites sent."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.api_route("/cron/recalculate-scores", methods=["GET", "POST"])
async def trigger_score_recalculation():
    """Cron endpoint to recalculate scores for all players."""
    import traceback
    try:
        print("DEBUG: Attempting to import score_calculator")
        from score_calculator import recalculate_player_scores
    except ImportError as e:
        print(f"DEBUG: Import Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to import score calculator: {str(e)}")
        
    try:
        print("DEBUG: calling recalculate_player_scores")
        count = recalculate_player_scores()
        return {"message": f"Scores recalculated successfully for {count} players"}
    except Exception as e:
        print(f"DEBUG: Execution Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/matches/{match_id}/feedback")
async def trigger_match_feedback(match_id: str, force: bool = False):
    """Manually trigger feedback SMS for a specific match (for testing/admin)."""
    try:
        from feedback_scheduler import trigger_feedback_for_match
        result = trigger_feedback_for_match(match_id, force=force)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/matches/{match_id}/result-nudge")
async def trigger_result_nudge(match_id: str):
    """Manually trigger a result request SMS for a specific match."""
    try:
        from result_nudge_scheduler import trigger_result_nudge_for_match
        result = trigger_result_nudge_for_match(match_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/create-confirmed-match")
async def admin_create_confirmed_match(request: CreateConfirmedMatchRequest):


    try:
        if len(request.player_ids) != 4:
            raise HTTPException(status_code=400, detail="Exactly 4 players are required.")
            
        if request.scheduled_time:
            # Use to_utc_iso for consistent timezone handling
            scheduled_time = to_utc_iso(request.scheduled_time, request.club_id)
        else:
            scheduled_time = get_now_utc().isoformat()
        
        # Split players into 2 teams
        team_1 = request.player_ids[:2]
        team_2 = request.player_ids[2:]
        
        match_data = {
            "club_id": request.club_id,
            "team_1_players": team_1,
            "team_2_players": team_2,
            "scheduled_time": scheduled_time,
            "status": "confirmed",
            "originator_id": team_1[0],
            "teams_verified": True
        }
        
        print(f"DEBUG: Creating match with data: {match_data}")
        try:
            result = supabase.table("matches").insert(match_data).execute()
        except Exception as e:
            print(f"DEBUG: Supabase insert error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {str(e)}")

        if not result.data:
            print(f"DEBUG: Supabase returned no data. Result: {result}")
            raise HTTPException(status_code=500, detail="Failed to create match record (no data returned).")
            
        match = result.data[0]
        
        # Also create accepted invites for all 4 players so they are linked
        invite_data = []
        for pid in request.player_ids:
            invite_data.append({
                "match_id": match["match_id"],
                "player_id": pid,
                "status": "accepted",
                "sent_at": get_now_utc().isoformat(),
                "responded_at": get_now_utc().isoformat()
            })
        
        supabase.table("match_invites").insert(invite_data).execute()
        
        return {"match": match, "message": "Confirmed match created successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/matches/bulk-delete")
async def bulk_delete_matches(request: BulkMatchDeleteRequest):
    """
    Delete multiple matches and all their associated data.
    Ensures cascading cleanup of invites, feedback, and rating history.
    """
    if not request.match_ids:
        return {"message": "No matches selected for deletion.", "deleted_count": 0}

    try:
        match_ids = request.match_ids
        print(f"ADMIN: Bulk deleting {len(match_ids)} matches: {match_ids}")

        # 1. Delete associated records in order of dependency
        # We use .in_() for batch deletion which is efficient
        
        # Delete match feedback
        supabase.table("match_feedback").delete().in_("match_id", match_ids).execute()
        
        # Delete match invites
        supabase.table("match_invites").delete().in_("match_id", match_ids).execute()

        # Delete feedback requests
        supabase.table("feedback_requests").delete().in_("match_id", match_ids).execute()
        
        # Delete rating history
        supabase.table("player_rating_history").delete().in_("match_id", match_ids).execute()

        # Delete match votes
        supabase.table("match_votes").delete().in_("match_id", match_ids).execute()

        # Finally, delete the matches themselves
        result = supabase.table("matches").delete().in_("match_id", match_ids).execute()
        
        deleted_count = len(result.data or [])
        print(f"ADMIN: Successfully deleted {deleted_count} matches.")
        
        return {
            "message": f"Successfully deleted {deleted_count} matches and all associated records.",
            "deleted_count": deleted_count
        }
    except Exception as e:
        print(f"ERROR: Bulk delete failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matches/{match_id}/feedback")
async def get_match_feedback(match_id: str):


    try:
        # 1. Get raw feedback rows
        # Join rater details
        feedback_res = supabase.table("match_feedback").select(
            "*, rater:player_id(name)"
        ).eq("match_id", match_id).execute()
        
        raw_feedback = feedback_res.data or []
        if not raw_feedback:
            return {"feedback": []}
            
        # 2. Get all player names to resolve keys in JSONB
        # We can just fetch players involved in this match (rater + rated)
        # But easier to just fetch all players in the match context
        
        # Get rater names map
        rater_map = {item["player_id"]: item["rater"]["name"] for item in raw_feedback if item.get("rater")}
        
        # Collect all rated IDs
        rated_ids = set()
        for item in raw_feedback:
            ratings = item.get("individual_ratings") or {}
            rated_ids.update(ratings.keys())
            
        # Fetch names for rated players
        rated_map = {}
        if rated_ids:
            p_res = supabase.table("players").select("player_id, name").in_("player_id", list(rated_ids)).execute()
            rated_map = {p["player_id"]: p["name"] for p in p_res.data}
            
        # 3. Flatten structure
        flattened_feedback = []
        for item in raw_feedback:
            rater_id = item["player_id"]
            rater_name = rater_map.get(rater_id, "Unknown")
            ratings = item.get("individual_ratings") or {}
            
            for rated_id, score in ratings.items():
                flattened_feedback.append({
                    "feedback_id": f"{item['feedback_id']}_{rated_id}", # Synthetic ID
                    "match_id": match_id,
                    "player_id": rater_id,
                    "rated_player_id": rated_id,
                    "rating": score,
                    "comment": item.get("nps_comment"), # Optional general comment
                    "created_at": item["created_at"],
                    "rater": {"name": rater_name},
                    "rated": {"name": rated_map.get(rated_id, "Unknown")}
                })
                
        # Sort by most recent
        flattened_feedback.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {"feedback": flattened_feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ClubSettingsUpdate(BaseModel):
    feedback_delay_hours: Optional[float] = None
    feedback_reminder_delay_hours: Optional[float] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
    sms_test_mode: Optional[bool] = None
    sms_whitelist: Optional[str] = None
    invite_timeout_minutes: Optional[int] = None
    initial_batch_size: Optional[int] = None


@router.get("/clubs/{club_id}/settings")
async def get_club_settings(club_id: str):


    try:
        result = supabase.table("clubs").select("settings").eq("club_id", club_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Club not found")
        
        settings = result.data[0].get("settings") or {}
        # Return with defaults
        return {
            "feedback_delay_hours": settings.get("feedback_delay_hours", 3.0),
            "feedback_reminder_delay_hours": settings.get("feedback_reminder_delay_hours", 4.0),
            "quiet_hours_start": settings.get("quiet_hours_start", 21),
            "quiet_hours_end": settings.get("quiet_hours_end", 8),
            "sms_test_mode": settings.get("sms_test_mode", False),
            "sms_whitelist": settings.get("sms_whitelist", ""),
            "invite_timeout_minutes": settings.get("invite_timeout_minutes", 15),
            "initial_batch_size": settings.get("initial_batch_size", 6)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/clubs/{club_id}/settings")
async def update_club_settings(club_id: str, updates: ClubSettingsUpdate):
    """Update club settings."""
    from database import supabase
    try:
        # Get current settings
        result = supabase.table("clubs").select("settings").eq("club_id", club_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Club not found")
        
        current_settings = result.data[0].get("settings") or {}
        
        # Merge updates
        if updates.feedback_delay_hours is not None:
            current_settings["feedback_delay_hours"] = updates.feedback_delay_hours
        if updates.feedback_reminder_delay_hours is not None:
            current_settings["feedback_reminder_delay_hours"] = updates.feedback_reminder_delay_hours
        if updates.quiet_hours_start is not None:
            current_settings["quiet_hours_start"] = updates.quiet_hours_start
        if updates.quiet_hours_end is not None:
            current_settings["quiet_hours_end"] = updates.quiet_hours_end
        if updates.sms_test_mode is not None:
            current_settings["sms_test_mode"] = updates.sms_test_mode
        if updates.sms_whitelist is not None:
            current_settings["sms_whitelist"] = updates.sms_whitelist
        if updates.invite_timeout_minutes is not None:
            current_settings["invite_timeout_minutes"] = updates.invite_timeout_minutes
        if updates.initial_batch_size is not None:
            current_settings["initial_batch_size"] = updates.initial_batch_size
        
        # Save
        supabase.table("clubs").update({
            "settings": current_settings
        }).eq("club_id", club_id).execute()
        
        return {"message": "Settings updated", "settings": current_settings}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Groups ---

class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: Optional[str] = 'private'
    initial_member_ids: List[str] = []

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None

class AddGroupMembersRequest(BaseModel):
    player_ids: List[str]

@router.get("/clubs/{club_id}/groups")
async def get_club_groups(club_id: str):
    """Get all groups for a club."""
    from database import supabase
    try:
        # Get groups
        result = supabase.table("player_groups").select("*").eq("club_id", club_id).order("name").execute()
        groups = result.data or []
        
        # For each group, get member count
        for group in groups:
            # We can't do a join or count easily in one query with this client sometimes, 
            # so we'll do a separate count for now or use a view if performance matters.
            # Simplified approach: query memberships count
            count_res = supabase.table("group_memberships").select("player_id", count="exact").eq("group_id", group["group_id"]).execute()
            group["member_count"] = count_res.count # count="exact" returns count in property
            
        return {"groups": groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clubs/{club_id}/groups")
async def create_group(club_id: str, request: CreateGroupRequest):
    """Create a new player group."""
    from database import supabase
    try:
        # 1. Create Group
        group_data = {
            "club_id": club_id,
            "name": request.name,
            "description": request.description,
            "visibility": request.visibility
        }
        result = supabase.table("player_groups").insert(group_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create group")
        
        new_group = result.data[0]
        group_id = new_group["group_id"]
        
        # 2. Add members if any
        if request.initial_member_ids:
            members_data = [{"group_id": group_id, "player_id": pid} for pid in request.initial_member_ids]
            supabase.table("group_memberships").insert(members_data).execute()
            
        return {"group": new_group, "message": "Group created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/groups/{group_id}")
async def get_group(group_id: str):
    """Get details for a specific group including members."""
    from database import supabase
    try:
        # Get group info
        group_res = supabase.table("player_groups").select("*").eq("group_id", group_id).execute()
        if not group_res.data:
            raise HTTPException(status_code=404, detail="Group not found")
        group = group_res.data[0]
        
        # Get members with player details
        # Using a join-like query via Supabase syntax: select player_id, players:player_id(...)
        # Actually standard PostgREST: select(..., players(...))
        # assuming foreign key is detected.
        # But we defined the schema manually, so PostgREST should pick up the FK.
        # Let's try explicit join query
        
        members_res = supabase.table("group_memberships").select(
            "added_at, players!inner(player_id, name, phone_number, declared_skill_level)"
        ).eq("group_id", group_id).execute()
        
        # Flatten structure
        members = []
        for m in (members_res.data or []):
             p = m["players"]
             p["added_at"] = m["added_at"]
             members.append(p)
             
        # Sort by name
        members.sort(key=lambda x: x["name"])
        
        return {"group": group, "members": members}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/groups/{group_id}")
async def update_group(group_id: str, request: UpdateGroupRequest):
    """Update group details (name, description, visibility)."""
    from database import supabase
    try:
        # Build updates dict from non-None fields
        updates = {}
        if request.name is not None:
            updates["name"] = request.name
        if request.description is not None:
            updates["description"] = request.description
        if request.visibility is not None:
            updates["visibility"] = request.visibility
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
            
        result = supabase.table("player_groups").update(updates).eq("group_id", group_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Group not found")
            
        return {"group": result.data[0], "message": "Group updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/groups/{group_id}/members")
async def add_group_members(group_id: str, request: AddGroupMembersRequest):
    """Add members to a group."""
    from database import supabase
    try:
        # Filter out existing members to avoid unique constraint errors
        # Or use upsert (ignore duplicates)
        # supabase.insert usually errors on duplicate. 
        # simpler: insert and ignore error or check first.
        # Let's check first.
        
        existing_res = supabase.table("group_memberships").select("player_id").eq("group_id", group_id).in_("player_id", request.player_ids).execute()
        existing_ids = {row["player_id"] for row in existing_res.data}
        
        new_ids = [pid for pid in request.player_ids if pid not in existing_ids]
        
        if new_ids:
            data = [{"group_id": group_id, "player_id": pid} for pid in new_ids]
            supabase.table("group_memberships").insert(data).execute()
            
        return {"message": f"Added {len(new_ids)} new members"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/groups/{group_id}/members/{player_id}")
async def remove_group_member(group_id: str, player_id: str):
    """Remove a member from a group."""
    from database import supabase
    try:
        supabase.table("group_memberships").delete().match({"group_id": group_id, "player_id": player_id}).execute()
        return {"message": "Member removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Scenario Tester ---

class ScenarioStep(BaseModel):
    user_input: str
    expected_intent: Optional[str] = None
    expected_entities: Optional[Dict[str, Any]] = None

class ScenarioRequest(BaseModel):
    steps: List[ScenarioStep]
    initial_state: Optional[str] = "IDLE"

class GoldenScenarioRequest(BaseModel):
    name: str
    initial_state: str
    steps: List[Dict[str, Any]]

@router.get("/test/scenarios")
async def get_golden_scenarios():
    """Fetch all saved golden test cases."""
    from database import supabase
    try:
        result = supabase.table("reasoner_test_cases").select("*").order("created_at", desc=True).execute()
        return {"scenarios": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test/scenarios")
async def save_golden_scenario(request: GoldenScenarioRequest):
    """Save a scenario as a golden test case."""
    from database import supabase
    try:
        data = {
            "name": request.name,
            "initial_state": request.initial_state,
            "steps": request.steps
        }
        result = supabase.table("reasoner_test_cases").insert(data).execute()
        return {"scenario": result.data[0], "message": "Golden scenario saved."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/test/scenarios/{scenario_id}")
async def delete_golden_scenario(scenario_id: str):
    """Delete a golden test case."""
    from database import supabase
    try:
        supabase.table("reasoner_test_cases").delete().eq("id", scenario_id).execute()
        return {"message": "Scenario deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.api_route("/test/scenario", methods=["GET", "POST"])
async def run_scenario(request: ScenarioRequest = None):
    """
    Run a conversational scenario through the Reasoner.
    """
    from typing import Dict, Any
    
    # Handle GET or empty body
    if not request or not request.steps:
        return {"message": "Scenario Tester Endpoint is Reachable. Use POST with steps to test."}
        
    # Lazy import to prevent module-level crashes if generic lib is missing/broken
    try:
        from logic.reasoner import reason_message
    except ImportError as e:
         raise HTTPException(status_code=500, detail=f"Failed to import reasoner: {e}")

    results = []
    current_state = request.initial_state
    
    try:
        for step in request.steps:
            # 1. Reason about the message
            mock_player = {"name": "Test User", "skill_level": 4.0}
            
            reasoner_result = reason_message(step.user_input, current_state, mock_player)
            
            # 2. Simulate state transition logic (simplified)
            next_state = current_state
            reply_action = "NONE"
            
            if reasoner_result.intent == "START_MATCH":
                if reasoner_result.entities.get("date") and reasoner_result.entities.get("time"):
                    next_state = "IDLE"
                    reply_action = "INITIATE_MATCH"
                else:
                    next_state = msg.STATE_MATCH_REQUEST_DATE
                    reply_action = "ASK_DATE"
            elif reasoner_result.intent == "JOIN_GROUP":
                next_state = msg.STATE_BROWSING_GROUPS
                reply_action = "LIST_GROUPS"
            elif reasoner_result.intent == "SUBMIT_FEEDBACK" and current_state == msg.STATE_WAITING_FEEDBACK:
                next_state = "IDLE"
                reply_action = "THANKS_FEEDBACK"
            elif reasoner_result.intent == "CHECK_STATUS":
                reply_action = "SHOW_MATCHES"
            elif reasoner_result.intent == "RESET":
                next_state = "IDLE"
                reply_action = "SYSTEM_RESET"
            
            # 3. Check against expectations if provided
            passed_intent = True
            if step.expected_intent:
                passed_intent = (reasoner_result.intent == step.expected_intent)
                 
            # Add result
            results.append({
                "input": step.user_input,
                "intent": reasoner_result.intent,
                "confidence": reasoner_result.confidence,
                "entities": reasoner_result.entities,
                "state_before": current_state,
                "state_after": next_state,
                "simulated_reply": reply_action,
                "reasoning": reasoner_result.raw_reply,
                "expected_intent": step.expected_intent,
                "passed_intent": passed_intent
            })
            
            current_state = next_state

        return {"step_results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
@router.put("/assessment/results/{result_id}")
async def update_assessment_result(result_id: str, request: AssessmentUpdate):
    """Update an assessment result (e.g., player name)."""
    from database import supabase
    try:
        result = supabase.table("assessment_results").update({
            "player_name": request.player_name
        }).eq("id", result_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Assessment result not found")
        
        return {"result": result.data[0], "message": "Assessment result updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/assessment/results")
async def get_assessment_results():
    """Get all player level assessment results."""
    from database import supabase
    try:
        result = supabase.table("assessment_results").select("*").order("created_at", desc=True).execute()
        return {"results": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assessment/results")
async def save_assessment_result(request: AssessmentResultRequest):
    """Save a player's level assessment result."""
    from database import supabase
    import traceback
    print(f"DEBUG: Received assessment result for {request.player_name}")
    try:
        data = {
            "player_name": request.player_name,
            "responses": request.responses,
            "rating": request.rating,
            "breakdown": request.breakdown
        }
        print(f"DEBUG: Inserting data into assessment_results: {data}")
        result = supabase.table("assessment_results").insert(data).execute()
        
        if not result.data:
            print("DEBUG: Failed to save assessment result - no data returned")
            raise HTTPException(status_code=500, detail="Failed to save assessment result")
        
        print(f"DEBUG: Successfully saved assessment result: {result.data[0]['id']}")
        return {"result": result.data[0], "message": "Assessment result saved successfully"}
    except Exception as e:
        print(f"DEBUG: Error saving assessment result: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/groups/{group_id}/suggested-numbers")
async def get_suggested_numbers(group_id: str):
    """Get suggested phone numbers for a group based on club's area code."""
    try:
        # Get group's club_id
        group_res = supabase.table("player_groups").select("club_id").eq("group_id", group_id).maybe_single().execute()
        if not group_res.data:
             raise HTTPException(status_code=404, detail="Group not found")
        
        club_id = group_res.data["club_id"]
        area_code = twilio_manager.get_club_area_code(club_id)
        numbers = twilio_manager.search_available_numbers(area_code)
        
        return {"numbers": numbers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/groups/{group_id}/provision-number")
async def provision_number(group_id: str, request: Dict[str, str]):
    """Provision a specific phone number for a group."""
    phone_number = request.get("phone_number")
    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")
    
    success, result = twilio_manager.provision_group_number(group_id, phone_number)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"status": "success", "phone_number": result}


@router.get("/groups/{group_id}/release-number")
async def release_number_get(group_id: str):
    """Legacy endpoint for release-number."""
    return await release_number(group_id)

@router.delete("/groups/{group_id}/release-number")
async def release_number(group_id: str):
    """Release the dedicated phone number for a group."""
    success, result = twilio_manager.release_group_number(group_id)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"status": "success", "message": result}


@router.post("/clubs/{club_id}/provision-number")
async def provision_club_number(club_id: str, request: Dict[str, str]):
    """Provision a specific phone number for a club."""
    phone_number = request.get("phone_number")
    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")
    
    success, result = twilio_manager.provision_club_number(club_id, phone_number)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"status": "success", "phone_number": result}

@router.delete("/clubs/{club_id}/release-number")
async def release_club_number(club_id: str):
    """Release the Twilio phone number for a club."""
    success, result = twilio_manager.release_club_number(club_id)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    
    return {"status": "success", "message": result}
