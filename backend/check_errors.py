from database import supabase
from datetime import datetime, timezone, timedelta
import json

def get_latest_errors():
    # Last 10 minutes
    since = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    res = supabase.table("error_logs").select("*").gte("created_at", since).order("created_at", desc=True).limit(5).execute()
    if res.data:
        for err in res.data:
            print(f"--- Error {err['error_id']} at {err['created_at']} ---")
            print(f"Type: {err.get('error_type')}")
            print(f"Message: {err.get('error_message')}")
            print(f"Handler: {err.get('handler_name')}")
            print(f"StackTrace: {err.get('stack_trace')}")
            print("-" * 40)
    else:
        print("No NEW errors found in last 10 minutes.")

if __name__ == "__main__":
    get_latest_errors()
