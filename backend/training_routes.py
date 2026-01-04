from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from database import supabase
import json

router = APIRouter(prefix="/training", tags=["training"])

class TrainingStepRequest(BaseModel):
    player_id: str
    message: str
    club_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []
    golden_samples: Optional[List[Dict[str, Any]]] = []

class EventTriggerRequest(BaseModel):
    event_type: str  # e.g., "MATCH_FEEDBACK"
    match_id: Optional[str] = None
    player_id: Optional[str] = None
    player_ids: Optional[List[str]] = None
    club_id: Optional[str] = None

class CorrectionRequest(BaseModel):
    name: str  # Name of the golden test case
    initial_state: str
    steps: List[Dict[str, Any]] # The corrected steps

@router.post("/step")
async def training_step(request: TrainingStepRequest):
    """
    Process a single message in dry-run mode for training purposes.
    """
    from sms_handler import handle_incoming_sms
    try:
        # 1. Fetch player details for context
        player_res = supabase.table("players").select("*").eq("player_id", request.player_id).execute()
        if not player_res.data:
            raise HTTPException(status_code=404, detail="Player not found")
        player = player_res.data[0]
        
        # 2. Fetch club settings for phone number context
        # Use provided club_id or fallback to player's first membership
        club_id = request.club_id
        if not club_id:
            member_res = supabase.table("club_members").select("club_id").eq("player_id", player["player_id"]).limit(1).execute()
            club_id = member_res.data[0]["club_id"] if member_res.data else None
        
        to_number = None
        if club_id:
            club_res = supabase.table("clubs").select("phone_number").eq("club_id", club_id).execute()
            to_number = club_res.data[0]["phone_number"] if club_res.data else None

        # 3. Call sms_handler in dry_run mode
        result = handle_incoming_sms(
            from_number=player["phone_number"],
            body=request.message,
            to_number=to_number,
            club_id=club_id,
            dry_run=True,
            history=request.history,
            golden_samples=request.golden_samples
        )
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/correct")
async def save_correction(request: CorrectionRequest):
    """
    Save a corrected conversation as a golden test case.
    """
    try:
        data = {
            "name": request.name,
            "initial_state": request.initial_state,
            "steps": request.steps
        }
        result = supabase.table("reasoner_test_cases").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save golden test case")
            
        return {"status": "success", "scenario": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/golden-samples")
async def get_golden_samples():
    """
    Fetch all golden test cases to use as few-shot examples.
    """
    try:
        result = supabase.table("reasoner_test_cases").select("*").order("created_at", desc=True).execute()
        return {"samples": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trigger-event")
async def trigger_event(request: EventTriggerRequest):
    """
    Manually trigger a background event (like feedback) in dry-run mode.
    """
    from feedback_scheduler import trigger_feedback_for_match
    from twilio_client import set_dry_run, get_dry_run_responses
    
    try:
        if request.event_type == "MATCH_FEEDBACK":
            if not request.match_id:
                raise HTTPException(status_code=400, detail="match_id required for MATCH_FEEDBACK")
            
            # Enable dry run to capture outbound SMS
            set_dry_run(True)
            try:
                match_id = request.match_id
                match_obj = None
                
                if match_id.startswith("SIM_MATCH"):
                    print(f"[TRAINING] Constructing mock match for {match_id}")
                    # Construct a mock match object for dry run
                    from logic_utils import get_now_utc
                    now = get_now_utc()
                    
                    # Ensure we have enough players
                    p_ids = request.player_ids or []
                    if len(p_ids) < 4:
                        # Try to find more players from the club if needed, or just pad
                        p_ids = (p_ids + ["sim_p1", "sim_p2", "sim_p3", "sim_p4"])[:4]
                    
                    match_obj = {
                        "match_id": match_id,
                        "club_id": request.club_id,
                        "team_1_players": p_ids[:2],
                        "team_2_players": p_ids[2:4],
                        "scheduled_time": now.isoformat(),
                        "status": "confirmed"
                    }

                result = trigger_feedback_for_match(match_id, force=True, match_obj=match_obj)
                responses = get_dry_run_responses()
                
                return {
                    "status": "success",
                    "event": "MATCH_FEEDBACK",
                    "responses": responses,
                    "detail": result
                }
            finally:
                set_dry_run(False)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown event type: {request.event_type}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
