import os
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def seed_club():
    # Check if any club exists
    response = supabase.table("clubs").select("*").execute()
    if response.data:
        print(f"Club already exists: {response.data[0]['name']}")
        return

    # Create default club
    new_club = {
        "name": "South Beach Padel",
        "court_count": 6,
        "phone_number": os.environ.get("TWILIO_PHONE_NUMBER", "+15550000000"),
        "settings": {"business_hours": "8am-10pm"}
    }
    
    try:
        data = supabase.table("clubs").insert(new_club).execute()
        print(f"Created club: {new_club['name']}")
    except Exception as e:
        print(f"Error seeding club: {e}")

if __name__ == "__main__":
    seed_club()
