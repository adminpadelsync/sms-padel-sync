from database import supabase

def create_local_test_club():
    print("--- Creating Local Test Club ---")
    club_data = {
        "name": "Adams Local Padel",
        "court_count": 4,
        "phone_number": "+19995551234", # Temporary placeholder
        "settings": {
            "quiet_hours_start": 22,
            "quiet_hours_end": 7,
            "invite_batch_size": 4
        }
    }
    
    # Check if it exists
    existing = supabase.table("clubs").select("club_id").eq("name", "Adams Local Padel").execute()
    if existing.data:
        print(f"Club already exists: {existing.data[0]['club_id']}")
        return existing.data[0]['club_id']
    
    res = supabase.table("clubs").insert(club_data).execute()
    if res.data:
        print(f"Created club: {res.data[0]['club_id']}")
        return res.data[0]['club_id']
    else:
        print("Failed to create club.")
        return None

if __name__ == "__main__":
    create_local_test_club()
