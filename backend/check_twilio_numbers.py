import os
from twilio_client import get_twilio_client
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def list_available_numbers():
    print("--- Checking Twilio Numbers ---")
    client = get_twilio_client()
    if not client:
        print("Twilio client not configured.")
        return

    # 1. List purchased numbers
    print("\n--- Purchased Numbers ---")
    incoming = client.incoming_phone_numbers.list(limit=20)
    for record in incoming:
        print(f"{record.phone_number} | SID: {record.sid} | Name: {record.friendly_name}")
    
    # 2. Check which are unassigned in our DB
    print("\n--- Unassigned in Database ---")
    assigned_clubs = supabase.table("clubs").select("phone_number").execute().data or []
    assigned_groups = supabase.table("player_groups").select("phone_number").execute().data or []
    assigned_phones = {c.get("phone_number") for c in assigned_clubs}
    assigned_phones.update({g.get("phone_number") for g in assigned_groups})
    
    for record in incoming:
        if record.phone_number not in assigned_phones:
            print(f"AVAILABLE: {record.phone_number} ({record.friendly_name})")

if __name__ == "__main__":
    list_available_numbers()
