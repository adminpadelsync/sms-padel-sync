from database import supabase
import json

def check_system():
    # 1. Check recent error logs
    print("--- Recent Error Logs ---")
    res = supabase.table("error_logs").select("*").order("created_at", desc=True).limit(20).execute()
    if res.data:
        for err in res.data:
            print(f"[{err['created_at']}] {err['error_type']}: {err['error_message']}")
            if err.get('stack_trace'):
                print(f"Stack trace: {err['stack_trace'][:200]}...")
    else:
        print("No error logs found.")

    # 3. Check clubs
    print("\n--- Clubs ---")
    res = supabase.table("clubs").select("club_id, name, phone_number").execute()
    if res.data:
        for club in res.data:
            print(f"{club['name']} | ID: {club['club_id']} | Phone: {club['phone_number']}")
    else:
        print("No clubs found.")

if __name__ == "__main__":
    check_system()
