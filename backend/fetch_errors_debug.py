from database import supabase
import json
from datetime import datetime, timedelta

try:
    # Fetch errors from the last hour
    res = supabase.table("error_logs").select("*").order("created_at", desc=True).limit(20).execute()
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error: {e}")
