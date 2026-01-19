from database import supabase
import json

try:
    res = supabase.table("clubs").select("*").execute()
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error: {e}")
