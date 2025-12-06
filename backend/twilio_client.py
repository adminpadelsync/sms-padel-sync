import os
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv

load_dotenv()

account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
from_number = os.environ.get("TWILIO_PHONE_NUMBER")
test_mode = os.environ.get("SMS_TEST_MODE", "false").lower() == "true"

def get_twilio_client():
    if not account_sid or not auth_token:
        print("Warning: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set")
        return None
    return Client(account_sid, auth_token)

def send_sms(to_number: str, body: str) -> bool:
    # Test mode: store in outbox instead of sending
    if test_mode:
        try:
            from database import supabase
            supabase.table("sms_outbox").insert({
                "to_number": to_number,
                "body": body
            }).execute()
            print(f"[TEST MODE] Stored SMS to {to_number}: {body[:50]}...")
            return True
        except Exception as e:
            print(f"[TEST MODE] Error storing SMS: {e}")
            return False
    
    # Production mode: send via Twilio
    client = get_twilio_client()
    if not client:
        return False
    
    try:
        message = client.messages.create(
            body=body,
            from_=from_number,
            to=to_number
        )
        return True
    except TwilioRestException as e:
        print(f"Twilio Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending SMS: {e}")
        return False

