import os
from database import supabase

def check_clubs():
    result = supabase.table("clubs").select("name, booking_system, playbypoint_credentials").execute()
    for club in result.data:
        print(f"Club: {club['name']}")
        print(f"  System: {club['booking_system']}")
        print(f"  Credentials: {club['playbypoint_credentials']}")
        print("-" * 20)

if __name__ == "__main__":
    check_clubs()
