import os
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def verify():
    print("--- Environment Verification ---")
    
    # 1. Check if we're hitting Test or Prod
    url = os.environ.get("SUPABASE_URL")
    if "kkdjtlwgvlgxzjdfboec" in url:
        env_name = "TEST (kkdjtlwg...)"
    elif "mqsphpkotueoyngdsxwt" in url:
        env_name = "PRODUCTION (mqsphpko...)"
    else:
        env_name = "UNKNOWN"
        
    print(f"Target Project: {env_name}")
    print(f"Supabase URL:   {url}")
    
    # 2. Test Connection
    try:
        res = supabase.table("clubs").select("name").limit(1).execute()
        print(f"Connection:     SUCCESS")
        print(f"Sample Data:    {res.data}")
    except Exception as e:
        print(f"Connection:     FAILED")
        print(f"Error:          {e}")

if __name__ == "__main__":
    verify()
