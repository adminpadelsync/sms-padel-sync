import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def check_user():
    url = os.getenv("SUPABASE_URL_TEST")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not url or not key:
        print("Test env vars not found")
        return
        
    supabase = create_client(url, key)
    
    email = "adamr151924@gmail.com"
    
    # Check public.users
    public_user = supabase.table("users").select("*").eq("email", email).execute().data
    print(f"Public User: {public_user}")
    
    # Check auth.users (via admin API)
    # Note: list_users is paginated
    auth_users = supabase.auth.admin.list_users()
    found_in_auth = False
    for user in auth_users:
        if user.email == email:
            print(f"Auth User found: {user.id}")
            found_in_auth = True
            break
    
    if not found_in_auth:
        print("Auth User NOT found")

if __name__ == "__main__":
    check_user()
