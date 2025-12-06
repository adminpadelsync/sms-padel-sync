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
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_routes.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "SMS Padel Sync API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

from sms_handler import handle_incoming_sms

@app.post("/webhook/sms")
async def sms_webhook(From: str = Form(...), Body: str = Form(...)):
    """
    Handle incoming SMS from Twilio.
    Twilio sends data as form-encoded.
    """
    handle_incoming_sms(From, Body)
    return {"status": "success"}
