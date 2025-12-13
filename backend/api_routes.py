from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uuid
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

class ClubUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    poc_name: Optional[str] = None
    poc_phone: Optional[str] = None
    main_phone: Optional[str] = None
    booking_system: Optional[str] = None

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
    from database import supabase
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

# IMPORTANT: This route MUST come before /matches/{match_id} or "confirmed" gets treated as a match_id
@router.get("/matches/confirmed")
async def get_confirmed_matches(club_id: str = None):
    """Get all confirmed/completable matches for feedback testing UI."""
    from database import supabase
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


@router.post("/cron/invite-timeout")
async def process_invite_timeouts():
    """Cron endpoint to process expired invites and send replacements."""
    from matchmaker import process_expired_invites
    try:
        new_invites = process_expired_invites()
        return {"message": f"Processed expired invites, sent {new_invites} replacement(s)"}
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

# --- Groups ---

class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    initial_member_ids: List[str] = []

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
            "description": request.description
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
