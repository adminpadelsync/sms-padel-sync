import os
from twilio.rest import Client
from database import supabase

account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
messaging_service_sid = os.environ.get("TWILIO_MESSAGING_SERVICE_SID")
webhook_url = os.environ.get("TWILIO_WEBHOOK_URL")

def get_twilio_client():
    if not account_sid or not auth_token:
        return None
    try:
        return Client(account_sid, auth_token)
    except Exception as e:
        print(f"[TWILIO] Client init error: {e}", flush=True)
        return None

def get_club_area_code(club_id):
    """Get the area code from the club's main phone number."""
    res = supabase.table("clubs").select("phone_number").eq("club_id", club_id).maybe_single().execute()
    if res.data and res.data.get("phone_number"):
        # Assuming E.164 format +1XXXYYYZZZZ
        phone = res.data["phone_number"]
        if phone.startswith("+1") and len(phone) >= 5:
            return phone[2:5]
    return "305"  # Default fallback (Miami area code as an example)

def search_available_numbers(area_code):
    """Search for available local numbers in the given area code."""
    client = get_twilio_client()
    if not client:
        return []
    
    try:
        numbers = client.available_phone_numbers('US').local.list(area_code=area_code, limit=5)
        return [{"phone_number": n.phone_number, "friendly_name": n.friendly_name} for n in numbers]
    except Exception as e:
        print(f"[TWILIO] Search error for area code {area_code}: {e}", flush=True)
        raise e

def provision_group_number(group_id, phone_number):
    """Purchase a number and link it to the group and messaging service."""
    client = get_twilio_client()
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Purchase the number and configure webhooks directly
        # If number is in a messaging service, individual webhooks might be overridden, 
        # but it's good practice to set them as a fallback or for non-service routing.
        params = {
            "phone_number": phone_number
        }
        if webhook_url:
            params["sms_url"] = webhook_url
            params["sms_method"] = "POST"
            
        purchased = client.incoming_phone_numbers.create(**params)
        
        # 2. Add to Messaging Service (if configured)
        if messaging_service_sid:
            try:
                client.messaging.v1.services(messaging_service_sid) \
                    .phone_numbers.create(phone_number_sid=purchased.sid)
            except Exception as ms_err:
                print(f"[TWILIO] MS Error (continuing): {ms_err}")
        
        # 3. Update database
        supabase.table("player_groups").update({
            "phone_number": phone_number,
            "twilio_sid": purchased.sid
        }).eq("group_id", group_id).execute()
        
        return True, phone_number
    except Exception as e:
        print(f"[TWILIO] Group Provisioning error: {e}")
        return False, str(e)

def provision_club_number(club_id, phone_number):
    """Purchase a number and link it to the club and messaging service."""
    client = get_twilio_client()
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Purchase the number and configure webhooks directly
        params = {
            "phone_number": phone_number
        }
        if webhook_url:
            params["sms_url"] = webhook_url
            params["sms_method"] = "POST"
            
        purchased = client.incoming_phone_numbers.create(**params)
        
        # 2. Add to Messaging Service (if configured)
        if messaging_service_sid:
            try:
                client.messaging.v1.services(messaging_service_sid) \
                    .phone_numbers.create(phone_number_sid=purchased.sid)
            except Exception as ms_err:
                print(f"[TWILIO] MS Error (continuing): {ms_err}")
        
        # 3. Update database
        supabase.table("clubs").update({
            "phone_number": phone_number,
            "twilio_sid": purchased.sid
        }).eq("club_id", club_id).execute()
        
        return True, phone_number
    except Exception as e:
        print(f"[TWILIO] Club Provisioning error: {e}")
        return False, str(e)

def release_club_number(club_id):
    """Release a purchased number and clear it from the club."""
    client = get_twilio_client()
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Get the SID from the database
        res = supabase.table("clubs").select("twilio_sid").eq("club_id", club_id).maybe_single().execute()
        if not res.data or not res.data.get("twilio_sid"):
            return False, "No active number found for this club"
        
        sid = res.data["twilio_sid"]
        
        # 2. Release in Twilio
        client.incoming_phone_numbers(sid).delete()
        
        # 3. Clear database
        supabase.table("clubs").update({
            "phone_number": None,
            "twilio_sid": None
        }).eq("club_id", club_id).execute()
        
        return True, "Number released successfully"
    except Exception as e:
        print(f"[TWILIO] Release error: {e}")
        return False, str(e)

def release_group_number(group_id):
    """Release a purchased number and clear it from the group."""
    client = get_twilio_client()
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Get the SID from the database
        res = supabase.table("player_groups").select("twilio_sid").eq("group_id", group_id).maybe_single().execute()
        if not res.data or not res.data.get("twilio_sid"):
            return False, "No active number found for this group"
        
        sid = res.data["twilio_sid"]
        
        # 2. Release in Twilio
        client.incoming_phone_numbers(sid).delete()
        
        # 3. Clear database
        supabase.table("player_groups").update({
            "phone_number": None,
            "twilio_sid": None
        }).eq("group_id", group_id).execute()
        
        return True, "Number released successfully"
    except Exception as e:
        print(f"[TWILIO] Release error: {e}")
        return False, str(e)
