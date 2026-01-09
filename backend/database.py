import os
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_client() -> Client:
    if not url or not key:
        if not url:
            print("Warning: SUPABASE_URL not set")
        if not key:
            print("Warning: SUPABASE_SERVICE_ROLE_KEY not set")
        return None
    
    # Increase timeout to 30 seconds for slow custom SMTP email sending
    options = ClientOptions(
        postgrest_client_timeout=30,
        storage_client_timeout=30
    )
    return create_client(url, key, options=options)

supabase = get_supabase_client()
