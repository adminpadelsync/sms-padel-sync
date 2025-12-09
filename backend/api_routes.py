from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
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

router = APIRouter()

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

class AddPlayerRequest(BaseModel):
    player_id: str
    team: int  # 1 or 2

class SendInvitesRequest(BaseModel):
    player_ids: List[str]

@router.get("/clubs")
async def get_clubs():
    """Get all active clubs."""
    from database import supabase
    try:
        result = supabase.table("clubs").select("club_id, name, settings").eq("active", True).execute()
        return {"clubs": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players")
async def get_players(club_id: str = None):
    """Get all players, optionally filtered by club."""
    from database import supabase
    try:
        query = supabase.table("players").select(
            "player_id, name, phone_number, declared_skill_level, gender, active_status"
        )
        if club_id:
            query = query.eq("club_id", club_id)
        result = query.eq("active_status", True).order("name").execute()
        return {"players": result.data or []}
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
    """Search for players by name in a club."""
    from database import supabase
    try:
        query = supabase.table("players").select(
            "player_id, name, phone_number, declared_skill_level, gender"
        ).eq("club_id", club_id).eq("active_status", True)
        
        if q:
            query = query.ilike("name", f"%{q}%")
        
        result = query.order("name").limit(20).execute()
        return {"players": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/outreach")
async def create_outreach(request: OutreachRequest):
    try:
        match = initiate_match_outreach(
            club_id=request.club_id,
            player_ids=request.player_ids,
            scheduled_time=request.scheduled_time,
            initial_player_ids=request.initial_player_ids
        )
        return {"match": match, "message": "Outreach initiated successfully"}
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
            updates['scheduled_time'] = request.scheduled_time
        if request.status is not None:
            updates['status'] = request.status
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        match = update_match(match_id, updates)
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


@router.post("/cron/feedback")
async def trigger_feedback_collection():
    """Cron endpoint to send feedback requests for recent matches."""
    from feedback_scheduler import run_feedback_scheduler
    try:
        result = run_feedback_scheduler()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/matches/{match_id}/feedback")
async def trigger_match_feedback(match_id: str):
    """Manually trigger feedback SMS for a specific match (for testing)."""
    from feedback_scheduler import trigger_feedback_for_match
    try:
        result = trigger_feedback_for_match(match_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/confirmed")
async def get_confirmed_matches(club_id: str):
    """Get all confirmed matches for a club (for feedback testing UI)."""
    from database import supabase
    try:
        result = supabase.table("matches").select(
            "match_id, scheduled_time, status, team_1_players, team_2_players, feedback_collected"
        ).eq("club_id", club_id).eq("status", "confirmed").order(
            "scheduled_time", desc=True
        ).limit(20).execute()
        
        matches = result.data or []
        
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


class ClubSettingsUpdate(BaseModel):
    feedback_delay_hours: Optional[float] = None
    feedback_reminder_delay_hours: Optional[float] = None


@router.get("/clubs/{club_id}/settings")
async def get_club_settings(club_id: str):
    """Get club settings."""
    from database import supabase
    try:
        result = supabase.table("clubs").select("settings").eq("club_id", club_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Club not found")
        
        settings = result.data[0].get("settings") or {}
        # Return with defaults
        return {
            "feedback_delay_hours": settings.get("feedback_delay_hours", 3.0),
            "feedback_reminder_delay_hours": settings.get("feedback_reminder_delay_hours", 4.0)
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
        
        # Save
        supabase.table("clubs").update({
            "settings": current_settings
        }).eq("club_id", club_id).execute()
        
        return {"message": "Settings updated", "settings": current_settings}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
