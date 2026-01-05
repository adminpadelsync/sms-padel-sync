import os
from twilio_client import get_twilio_client
from database import supabase
from dotenv import load_dotenv

load_dotenv()

def purchase_and_assign():
    phone_number = "+15614892694"
    client = get_twilio_client()
    
    print(f"--- Purchasing Number: {phone_number} ---")
    try:
        # 1. Purchase the number
        purchased_number = client.incoming_phone_numbers.create(
            phone_number=phone_number,
            friendly_name="Adams Local Padel (LOCAL TEST)"
        )
        print(f"Successfully purchased: {purchased_number.sid}")
        
        # 2. Update the database
        print(f"--- Assigning to 'Adams Local Padel' ---")
        res = supabase.table("clubs").update({
            "phone_number": phone_number
        }).eq("name", "Adams Local Padel").execute()
        
        if res.data:
            print(f"Database updated successfully.")
        else:
            print("Failed to update database.")
            
    except Exception as e:
        print(f"Error during purchase/assignment: {e}")

if __name__ == "__main__":
    purchase_and_assign()
