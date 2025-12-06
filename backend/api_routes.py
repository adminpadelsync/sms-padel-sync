from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from match_organizer import (
    get_player_recommendations, 
    initiate_match_outreach,
    get_match_details,
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
