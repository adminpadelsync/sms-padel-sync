import os
from twilio_client import send_sms
from dotenv import load_dotenv

load_dotenv()

def test_manual_send():
    user_num = "+15619851900"
    group_num = "+15616069224"
    club_id = "7247e6e9-fe91-40e6-ba02-1463cd79dcf3" # Replay Club
    
    print(f"Testing send from {group_num} to {user_num} for club {club_id}")
    
    # We pass group_num as reply_from to override default
    success = send_sms(user_num, "Test message from Padel Bros group number Diagnostic.", reply_from=group_num, club_id=club_id)
    
    if success:
        print("✅ SMS sent successfully (according to our code)")
    else:
        print("❌ SMS failed to send")

if __name__ == "__main__":
    test_manual_send()
