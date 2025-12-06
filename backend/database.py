import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_client() -> Client:
    if not url or not key:
        # Return None or raise error depending on if we want strict startup
        # For now, let's allow it to fail at runtime if env vars are missing
        # to avoid breaking import if just checking types etc.
        if not url:
            print("Warning: SUPABASE_URL not set")
        if not key:
            print("Warning: SUPABASE_SERVICE_ROLE_KEY not set")
        return None
    return create_client(url, key)

supabase = get_supabase_client()
