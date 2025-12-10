import os
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv

load_dotenv()

account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
from_number = os.environ.get("TWILIO_PHONE_NUMBER")
test_mode = os.environ.get("SMS_TEST_MODE", "false").lower() == "true"

# Whitelist of phone numbers that should receive real SMS (comma-separated)
# Numbers not on this list will be routed to the simulator outbox
sms_whitelist_raw = os.environ.get("SMS_WHITELIST", "")
sms_whitelist = set(num.strip() for num in sms_whitelist_raw.split(",") if num.strip())

# Debug logging for SMS configuration
print(f"[SMS CONFIG] SMS_TEST_MODE: {test_mode}")
print(f"[SMS CONFIG] SMS_WHITELIST raw: '{sms_whitelist_raw}'")
print(f"[SMS CONFIG] SMS_WHITELIST parsed: {sms_whitelist}")
print(f"[SMS CONFIG] Whitelist is empty: {len(sms_whitelist) == 0}")


def is_whitelisted(phone_number: str) -> bool:
    """Check if a phone number is whitelisted for real SMS."""
    # Normalize the phone number (remove spaces, ensure + prefix)
    normalized = phone_number.strip().replace(" ", "").replace("-", "")
    if not normalized.startswith("+"):
        normalized = "+" + normalized
    
    # Check against whitelist (also normalize whitelist entries)
    for whitelisted in sms_whitelist:
        normalized_whitelist = whitelisted.strip().replace(" ", "").replace("-", "")
        if not normalized_whitelist.startswith("+"):
            normalized_whitelist = "+" + normalized_whitelist
        if normalized == normalized_whitelist:
            return True
    return False


def store_in_outbox(to_number: str, body: str) -> bool:
    """Store SMS in outbox for simulator display."""
    try:
        from database import supabase
        supabase.table("sms_outbox").insert({
            "to_number": to_number,
            "body": body
        }).execute()
        print(f"[SIMULATOR] Stored SMS to {to_number}: {body[:50]}...")
        return True
    except Exception as e:
        print(f"[SIMULATOR] Error storing SMS: {e}")
        return False


def get_twilio_client():
    if not account_sid or not auth_token:
        print("Warning: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set")
        return None
    return Client(account_sid, auth_token)


def send_sms(to_number: str, body: str) -> bool:
    # Debug: log every SMS attempt
    print(f"[SMS DEBUG] send_sms called: to={to_number}")
    print(f"[SMS DEBUG] test_mode={test_mode}, whitelist_empty={len(sms_whitelist)==0}")
    
    # Full test mode: store all messages in outbox
    if test_mode:
        print(f"[SMS DEBUG] Routing to outbox (test_mode=True)")
        return store_in_outbox(to_number, body)
    
    # Whitelist mode: only send real SMS to whitelisted numbers
    if sms_whitelist:
        is_wl = is_whitelisted(to_number)
        print(f"[SMS DEBUG] Whitelist check: is_whitelisted({to_number})={is_wl}")
        if not is_wl:
            print(f"[WHITELIST] Number {to_number} not whitelisted, routing to simulator")
            return store_in_outbox(to_number, body)
    else:
        print(f"[SMS DEBUG] No whitelist configured, proceeding to Twilio")
    
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
        print(f"[TWILIO] Sent SMS to {to_number}")
        return True
    except TwilioRestException as e:
        print(f"Twilio Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending SMS: {e}")
        return False

