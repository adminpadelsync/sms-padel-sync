import os
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

# Database initialization
def get_config_var(name: str) -> str:
    if os.environ.get("TESTING") == "true":
        test_val = os.environ.get(f"{name}_TEST")
        if test_val:
            return test_val.strip()
    return (os.environ.get(name) or "").strip()

url: str = get_config_var("SUPABASE_URL")
key: str = get_config_var("SUPABASE_SERVICE_ROLE_KEY")

if not url:
    print("Warning: SUPABASE_URL not set")
if not key:
    print("Warning: SUPABASE_SERVICE_ROLE_KEY not set")

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
