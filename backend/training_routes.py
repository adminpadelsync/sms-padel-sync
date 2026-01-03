from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from database import supabase
import json

router = APIRouter(prefix="/training", tags=["training"])

class TrainingStepRequest(BaseModel):
    player_id: str
    message: str
    history: Optional[List[Dict[str, str]]] = []
    golden_samples: Optional[List[Dict[str, Any]]] = []

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
        
        # 2. Fetch club settings for phone number context if possible
        club_res = supabase.table("clubs").select("phone_number").eq("club_id", player["club_id"]).execute()
        to_number = club_res.data[0]["phone_number"] if club_res.data else None

        # 3. Call sms_handler in dry_run mode
        result = handle_incoming_sms(
            from_number=player["phone_number"],
            body=request.message,
            to_number=to_number,
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
