import os
from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings

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
    webhook_secret: str = "test_secret"

    class Config:
        env_file = ".env"
        extra = "ignore" # Allow extra fields if any

settings = Settings()

# For Vercel, requests come in at /api/* so we need to handle that
app = FastAPI(redirect_slashes=False)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use a fixed /api prefix for all routes to match Next.js rewrites perfectly.
api_prefix = "/api"

# Standard health routes (must be before prefix routes if we want to avoid conflicts, but prefix /api matches first)
@app.get("/")
@app.get("/api")
@app.get("/api/")
@app.get("/api/health")
@app.get("/api/health/")
async def root():
    return {"status": "healthy", "service": "SMS Padel Sync API"}

# Important: Import modules AFTER settings is defined and before include_router
import api_routes
import analytics_routes
import training_routes

# Include routers
app.include_router(api_routes.router, prefix=api_prefix)
app.include_router(analytics_routes.router, prefix=f"{api_prefix}/insights")
app.include_router(training_routes.router, prefix=api_prefix)

@app.post(f"{api_prefix}/webhook/sms")
@app.post(f"{api_prefix}/webhook/sms/")
async def sms_webhook(From: str = Form(...), Body: str = Form(...), To: str = Form(...)):
    """
    Handle incoming SMS from Twilio.
    Twilio sends data as form-encoded.
    To = the Twilio number that received the SMS (determines which club)
    """
    from sms_handler import handle_incoming_sms
    handle_incoming_sms(From, Body, To)
    return {"status": "success"}

@app.api_route(f"{api_prefix}/cron/recalculate-scores", methods=["GET", "POST"])
async def trigger_score_recalculation_direct():
    """Direct cron endpoint to debug routing issues."""
    from fastapi import HTTPException
    import traceback
    try:
        from score_calculator import recalculate_player_scores
        count = recalculate_player_scores()
        return {"message": f"Scores recalculated successfully for {count} players (DIRECT)"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.api_route(f"{api_prefix}/debug-routing", methods=["GET", "POST"])
async def debug_routing(request: Request):
    return {
        "root_path": request.scope.get("root_path"),
        "path": request.scope.get("path"),
        "method": request.method,
        "query_params": str(request.query_params)
    }

@app.get(f"{api_prefix}/debug-routes")
async def debug_routes():
    routes = []
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", None)
        routes.append(f"{methods} {path}")
    return {"routes": routes}
