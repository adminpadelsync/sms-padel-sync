from database import supabase
import json

try:
    # Check if match_invites has the columns refilled_at and expires_at
    res = supabase.table("match_invites").select("invite_id, expires_at, refilled_at").limit(1).execute()
    print("Columns checked successfully!")
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Schema Error: {e}")
