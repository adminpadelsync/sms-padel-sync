from database import supabase
import json

try:
    # Check expires_at
    try:
        supabase.table("match_invites").select("expires_at").limit(1).execute()
        print("expires_at exists")
    except Exception as e:
        print(f"expires_at check failed: {e}")

    # Check refilled_at
    try:
        supabase.table("match_invites").select("refilled_at").limit(1).execute()
        print("refilled_at exists")
    except Exception as e:
        print(f"refilled_at check failed: {e}")

except Exception as e:
    print(f"Error: {e}")
