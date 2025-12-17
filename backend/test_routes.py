from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from logic.reasoner import reason_message

router = APIRouter()

class ScenarioStep(BaseModel):
    user_input: str
    expected_intent: Optional[str] = None

class ScenarioRequest(BaseModel):
    steps: List[ScenarioStep]
    initial_state: Optional[str] = "IDLE"

class ScenarioResult(BaseModel):
    step_results: List[Dict[str, Any]]

@router.post("/test/scenario")
async def run_scenario(request: ScenarioRequest):
    """
    Run a conversational scenario through the Reasoner.
    Note: This only tests the NLP layer, not the full SMS state machine (which requires DB/Redis).
    """
    results = []
    current_state = request.initial_state
    
    for step in request.steps:
        # 1. Reason about the message
        # Mock player data for context
        mock_player = {"name": "Test User", "skill_level": 4.0}
        
        reasoner_result = reason_message(step.user_input, current_state, mock_player)
        
        # 2. Simulate state transition logic (simplified)
        # This mirrors the logic in sms_handler.py but is stateless
        next_state = current_state
        reply_action = "NONE"
        
        if reasoner_result.intent == "START_MATCH":
            next_state = "MATCH_REQUEST_DATE"
            reply_action = "ASK_DATE"
        elif reasoner_result.intent == "JOIN_GROUP":
            next_state = "BROWSING_GROUPS"
            reply_action = "LIST_GROUPS"
        elif reasoner_result.intent == "Check_STATUS":
             reply_action = "SHOW_MATCHES"
             
        # Add result
        results.append({
            "input": step.user_input,
            "intent": reasoner_result.intent,
            "confidence": reasoner_result.confidence,
            "entities": reasoner_result.entities,
            "state_before": current_state,
            "state_after": next_state,
            "simulated_reply": reply_action,
            "reasoning": reasoner_result.raw_reply
        })
        
        current_state = next_state

    return {"step_results": results}
