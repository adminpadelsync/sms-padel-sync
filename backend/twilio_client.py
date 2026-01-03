import os
from contextvars import ContextVar
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from typing import List
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

# Context variable to store the current club's phone number for replies
# This is set at the start of handling an incoming SMS and used by send_sms
_reply_from_context: ContextVar[str] = ContextVar('reply_from', default=None)
_club_name_context: ContextVar[str] = ContextVar('club_name', default=None)
_dry_run_context: ContextVar[bool] = ContextVar('dry_run', default=False)
_dry_run_responses: ContextVar[List[str]] = ContextVar('dry_run_responses', default=[])


def set_reply_from(phone_number: str):
    """Set the reply-from phone number for the current request context."""
    _reply_from_context.set(phone_number)


def get_reply_from() -> str:
    """Get the reply-from phone number for the current request context."""
    return _reply_from_context.get()


def set_club_name(name: str):
    """Set the club name for the current request context."""
    _club_name_context.set(name)


def get_club_name() -> str:
    """Get the club name for the current request context."""
    return _club_name_context.get() or "the club"


def set_dry_run(enabled: bool):
    """Enable or disable dry run mode for the current context."""
    _dry_run_context.set(enabled)
    if enabled:
        _dry_run_responses.set([])


def get_dry_run() -> bool:
    """Check if dry run mode is enabled."""
    return _dry_run_context.get()


def get_dry_run_responses() -> List[str]:
    """Get all messages captured during dry run."""
    return _dry_run_responses.get()


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


def send_sms(to_number: str, body: str, reply_from: str = None, club_id: str = None) -> bool:
    """
    Send an SMS message.
    
    Args:
        to_number: The recipient's phone number
        body: The message content
        reply_from: Optional - the Twilio number to send from (for multi-club support)
                   If not provided, uses the context variable or falls back to TWILIO_PHONE_NUMBER
        club_id: Optional - the ID of the club to fetch specific settings (test_mode, whitelist)
    """
    # Priority: explicit reply_from > context variable > default from env
    send_from = reply_from or get_reply_from() or from_number
    
    # 1. Fetch settings (Per-club or Global fallback)
    current_test_mode = test_mode
    current_whitelist = sms_whitelist
    
    if club_id:
        try:
            from database import supabase
            res = supabase.table("clubs").select("settings").eq("club_id", club_id).maybe_single().execute()
            if res.data and res.data.get("settings"):
                settings = res.data["settings"]
                # Use per-club settings if explicitly defined, otherwise stay with global
                if "sms_test_mode" in settings:
                    current_test_mode = settings["sms_test_mode"]
                if "sms_whitelist" in settings and settings["sms_whitelist"]:
                    raw_wl = settings["sms_whitelist"]
                    current_whitelist = set(num.strip() for num in raw_wl.split(",") if num.strip())
        except Exception as e:
            print(f"[SMS ERROR] Failed to fetch per-club settings for {club_id}: {e}")

    # Debug: log every SMS attempt
    print(f"[SMS DEBUG] send_sms called: to={to_number}, from={send_from}, club_id={club_id}")
    print(f"[SMS DEBUG] test_mode={current_test_mode}, whitelist_empty={len(current_whitelist)==0}")
    
    # Dry Run mode: capture message and return
    if get_dry_run():
        print(f"[DRY RUN] Capturing SMS to {to_number}: {body[:50]}...")
        current_responses = _dry_run_responses.get()
        current_responses.append(body)
        _dry_run_responses.set(current_responses)
        return True

    # Full test mode: store all messages in outbox
    if current_test_mode:
        print(f"[SMS DEBUG] Routing to outbox (test_mode=True)")
        return store_in_outbox(to_number, body)
    
    # Whitelist mode: only send real SMS to whitelisted numbers
    if current_whitelist:
        # Normalize to_number for comparison
        normalized_to = to_number.strip().replace(" ", "").replace("-", "")
        if not normalized_to.startswith("+"):
            normalized_to = "+" + normalized_to
            
        is_wl = False
        for whitelisted in current_whitelist:
            nw = whitelisted.strip().replace(" ", "").replace("-", "")
            if not nw.startswith("+"):
                nw = "+" + nw
            if normalized_to == nw:
                is_wl = True
                break
                
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
            from_=send_from,
            to=to_number
        )
        print(f"[TWILIO] Sent SMS to {to_number} from {send_from}")
        return True
    except TwilioRestException as e:
        print(f"Twilio Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending SMS: {e}")
        return False

