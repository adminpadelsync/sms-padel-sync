import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def try_delete():
    url = os.getenv("SUPABASE_URL_TEST")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not url or not key:
        print("Test env vars not found")
        return
        
    supabase = create_client(url, key)
    user_id = "0fb5d3ac-2887-45a5-bae9-6288e6af54b5" # ID from previous check
    
    print(f"Trying to delete user {user_id} from Auth...")
    try:
        res = supabase.auth.admin.delete_user(user_id)
        print("Auth delete succeeded (unexpected if already gone)")
    except Exception as e:
        print(f"Auth delete failed (expected if already gone): {e}")
        
    print(f"Checking public.users for {user_id}...")
    pub_res = supabase.table("users").select("*").eq("user_id", user_id).execute().data
    if pub_res:
        print(f"User still in public.users. Deleting manually...")
        del_res = supabase.table("users").delete().eq("user_id", user_id).execute()
        print(f"Manual delete result: {del_res.data}")
    else:
        print("User NOT in public.users")

if __name__ == "__main__":
    try_delete()
