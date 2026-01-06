from database import supabase
import json

def check_recent_errors():
    res = supabase.table("error_logs").select("*").order("created_at", desc=True).limit(1).execute()
    if res.data:
        print(json.dumps(res.data[0], indent=2))
    else:
        print("No errors found.")

if __name__ == "__main__":
    check_recent_errors()
