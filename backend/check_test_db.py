import os
from supabase import create_client

def check():
    url = "https://kkdjtlwgvlgxzjdfboec.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZGp0bHdndmxneGpsZGZib2VjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY3NTIwOSwiZXhwIjoyMDc5MjUxMjA5fQ.e_m4mK8Fqf3mD5P9-P0p8y_1-4_1_1_1" # This is a placeholder, I should get it from .env
    
    # Use the keys from .env directly
    from dotenv import load_dotenv
    load_dotenv()
    
    url = os.getenv("SUPABASE_URL_TEST")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not url or not key:
        print("Test env vars not found")
        return
        
    supabase = create_client(url, key)
    
    # Check clubs
    clubs = supabase.table("clubs").select("name, phone_number").ilike("name", "%Preview%").execute().data
    print(f"Test DB Clubs: {clubs}")
    
    # Check phone number directly
    club_by_phone = supabase.table("clubs").select("name").eq("phone_number", "+15619562492").execute().data
    print(f"Club by phone (+15619562492): {club_by_phone}")

if __name__ == "__main__":
    check()
