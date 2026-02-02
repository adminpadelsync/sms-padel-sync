import os
from contextvars import ContextVar
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from typing import List
from dotenv import load_dotenv

load_dotenv()

account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
default_from_number = os.environ.get("TWILIO_PHONE_NUMBER")

# Context variables for request context
_reply_from_context: ContextVar[str] = ContextVar("_reply_from_context", default=None)
_club_name_context: ContextVar[str] = ContextVar("_club_name_context", default=None)
_dry_run_context: ContextVar[bool] = ContextVar("_dry_run_context", default=False)
_force_test_mode_context: ContextVar[bool] = ContextVar("_force_test_mode_context", default=False)
_dry_run_responses: ContextVar[List[dict]] = ContextVar("_dry_run_responses", default=[])
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


def get_dry_run_responses() -> List[dict]:
    """Get all messages captured during dry run."""
    return _dry_run_responses.get()


def set_force_test_mode(enabled: bool):
    """Force test mode for the current context (traps SMS in outbox)."""
    _force_test_mode_context.set(enabled)


def get_force_test_mode() -> bool:
    """Check if force test mode is enabled."""
    return _force_test_mode_context.get()





def normalize_phone_number(phone: str) -> str:
    """Standardize phone numbers to +1XXXXXXXXXX format."""
    if not phone:
        return phone
    clean = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if clean.startswith("+"):
        return clean
    if clean.startswith("1") and len(clean) == 11:
        return "+" + clean
    if len(clean) == 10:
        return "+1" + clean
    return clean


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
    if not club_id:
        print("ERROR: send_sms called without club_id. This is forbidden, but trying default context for safety.")
        # Try to find a fallback club ID for logging/replying
        try:
            from database import supabase
            fallback_res = supabase.table("clubs").select("club_id").order("created_at").limit(1).execute()
            if fallback_res.data:
                club_id = str(fallback_res.data[0]["club_id"])
            else:
                print("CRITICAL: No clubs found in DB, Cannot send SMS.")
                return False
        except Exception as e:
            print(f"CRITICAL: Failed to fetch fallback club: {e}")
            return False

    # Normalize to_number (ensure consistent format for simulator matching)
    to_number = normalize_phone_number(to_number)

    # Priority: explicit reply_from > context variable > club-specific lookup > default from env
    send_from = reply_from or get_reply_from()
    
    # 1. Fetch settings and phone number from DB (MANDATORY)
    current_test_mode = False # Default to Live if club exists but key missing
    current_whitelist = set()
    club_phone = None
    
    try:
        from database import supabase
        res = supabase.table("clubs").select("settings, phone_number").eq("club_id", club_id).maybe_single().execute()
        if res.data:
            club_phone = res.data.get("phone_number")
            settings = res.data.get("settings")
            if settings:
                # Per-club settings from DB (no .env fallback)
                current_test_mode = settings.get("sms_test_mode", False)
                if "sms_whitelist" in settings and settings["sms_whitelist"]:
                    raw_wl = settings["sms_whitelist"]
                    current_whitelist = set(num.strip() for num in raw_wl.split(",") if num.strip())
        else:
            print(f"[SMS ERROR] club_id {club_id} not found in database. Cannot fetch settings.")
            return False
    except Exception as e:
        print(f"[SMS ERROR] Failed to fetch per-club data for {club_id}: {e}")
        return False

    # Use club_phone if we don't have a sender yet
    if not send_from and club_phone:
        send_from = club_phone
        
    # Final fallback to global default for the 'From' number only
    if not send_from:
        send_from = default_from_number

    # Debug: log every SMS attempt
    print(f"[SMS DEBUG] send_sms to={to_number}, from={send_from}, club_id={club_id}, body='{body[:50]}...'")
    print(f"[SMS DEBUG] test_mode={current_test_mode}, whitelist_count={len(current_whitelist)}")
    
    # Dry Run mode: capture message and return
    if get_dry_run():
        print(f"[DRY RUN] Capturing SMS to {to_number}: {body[:50]}...")
        current_responses = _dry_run_responses.get()
        current_responses.append({"to": to_number, "body": body})
        _dry_run_responses.set(current_responses)
        return True

    # Full test mode: store all messages in outbox
    if current_test_mode or get_force_test_mode():
        print(f"[SMS DEBUG] Routing to outbox (test_mode={current_test_mode}, force_test_mode={get_force_test_mode()})")
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
        print(f"[TWILIO] Sent SMS to {to_number} from {send_from} | SID: {message.sid} | Status: {message.status}")
        return True
    except TwilioRestException as e:
        print(f"[TWILIO ERROR] Rest Exception: {e}")
        return False
    except Exception as e:
        print(f"Error sending SMS: {e}")
        return False

