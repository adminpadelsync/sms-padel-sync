from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import api_routes

class Settings(BaseSettings):
    app_name: str = "Padel Sync API"
    admin_email: str = "admin@example.com"
    
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    
    # Twilio
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    
    # Redis
    redis_url: str
    
    # App
    node_env: str = "development"
    api_base_url: str = "http://localhost:3000"
    webhook_secret: str

    class Config:
        env_file = ".env"
        extra = "ignore" # Allow extra fields if any

settings = Settings()

# For Vercel, requests come in at /api/* so we need to handle that
import os
is_vercel = os.environ.get('VERCEL', False)

app = FastAPI(root_path="/api" if is_vercel else "")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes - remove /api prefix when on Vercel since /api is already in the path
import analytics_routes

# Include routes - remove /api prefix when on Vercel since /api is already in the path
prefix = "" if is_vercel else "/api"
app.include_router(api_routes.router, prefix=prefix)
app.include_router(analytics_routes.router, prefix=f"{prefix}/insights")

@app.get("/")
async def root():
    return {"message": "SMS Padel Sync API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

from sms_handler import handle_incoming_sms

@app.post("/webhook/sms")
async def sms_webhook(From: str = Form(...), Body: str = Form(...), To: str = Form(...)):
    """
    Handle incoming SMS from Twilio.
    Twilio sends data as form-encoded.
    To = the Twilio number that received the SMS (determines which club)
    """
    handle_incoming_sms(From, Body, To)
    return {"status": "success"}

# --- SMS Test Mode Endpoints ---
from database import supabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class InboxMessage(BaseModel):
    from_number: str
    body: str
    to_number: Optional[str] = None  # Club's Twilio number (optional for backward compat)

# SMS test mode routes - path depends on environment
sms_prefix = "" if os.environ.get('VERCEL', False) else "/api"

@app.get(f"{sms_prefix}/sms-outbox")
async def get_sms_outbox(phone_number: Optional[str] = None):
    """
    Get pending outbound SMS messages (test mode only).
    Optionally filter by phone_number.
    """
    query = supabase.table("sms_outbox").select("*").is_("read_at", "null").order("created_at", desc=False)
    if phone_number:
        query = query.eq("to_number", phone_number)
    result = query.execute()
    return {"messages": result.data}

@app.post(f"{sms_prefix}/sms-outbox/{{message_id}}/read")
async def mark_message_read(message_id: str):
    """Mark a message as read."""
    supabase.table("sms_outbox").update({"read_at": datetime.now().isoformat()}).eq("id", message_id).execute()
    return {"status": "ok"}

@app.post(f"{sms_prefix}/sms-inbox")
async def post_sms_inbox(message: InboxMessage):
    """
    Simulate an incoming SMS (test mode).
    Calls the same handler as the Twilio webhook.
    """
    # Default to first club's number if not specified (backward compat)
    to_number = message.to_number
    if not to_number:
        club_res = supabase.table("clubs").select("phone_number").limit(1).execute()
        to_number = club_res.data[0]["phone_number"] if club_res.data else None
    
    handle_incoming_sms(message.from_number, message.body, to_number)
    return {"status": "success"}

@app.api_route("/cron/recalculate-scores", methods=["GET", "POST"])
async def trigger_score_recalculation_direct():
    """Direct cron endpoint to debug routing issues."""
    from fastapi import HTTPException
    import traceback
    try:
        print("DEBUG: Direct cron endpoint hit")
        from score_calculator import recalculate_player_scores
        count = recalculate_player_scores()
        return {"message": f"Scores recalculated successfully for {count} players (DIRECT)"}
    except Exception as e:
        print(f"DEBUG: Direct cron error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.api_route("/debug-routing", methods=["GET", "POST"])
async def debug_routing(request: Request):
    return {
        "root_path": request.scope.get("root_path"),
        "path": request.scope.get("path"),
        "method": request.method,
        "raw_path": request.scope.get("raw_path").decode() if request.scope.get("raw_path") else None,
        "is_vercel": os.environ.get('VERCEL')
    }


