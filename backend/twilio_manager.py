import os
from twilio.rest import Client
from database import supabase

account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
messaging_service_sid = os.environ.get("TWILIO_MESSAGING_SERVICE_SID", "").strip()
webhook_url = os.environ.get("TWILIO_WEBHOOK_URL", "").strip()

def get_twilio_client():
    if not account_sid or not auth_token:
        return None
    try:
        return Client(account_sid, auth_token)
    except Exception as e:
        print(f"[TWILIO] Client init error: {e}", flush=True)
        return None

def format_phone_number(phone):
    """Format E.164 number to (XXX) YYY-ZZZZ for friendly names."""
    if not phone: return ""
    digits = "".join(filter(str.isdigit, phone))
    if len(digits) == 11 and digits.startswith('1'):
        return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return phone

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
        # Fetch group/club names for friendly name
        friendly_name = phone_number
        try:
            name_res = supabase.table("player_groups") \
                .select("name, clubs(name)") \
                .eq("group_id", group_id) \
                .single().execute()
            if name_res.data:
                g_name = name_res.data.get("name")
                c_name = name_res.data.get("clubs", {}).get("name")
                friendly_name = f"{format_phone_number(phone_number)} ({c_name} - {g_name})"
        except Exception as e:
            print(f"[TWILIO] Name fetch error for group {group_id}: {e}")

        params = {
            "phone_number": phone_number,
            "friendly_name": friendly_name
        }
        if webhook_url:
            params["sms_url"] = webhook_url
            params["sms_method"] = "POST"
            
        purchased = client.incoming_phone_numbers.create(**params)
        sid = purchased.sid
        
        # 2. Add to Messaging Service (if configured)
        if messaging_service_sid:
            try:
                client.messaging.v1.services(messaging_service_sid) \
                    .phone_numbers.create(phone_number_sid=sid)
            except Exception as ms_err:
                print(f"[TWILIO] MS Error (continuing): {ms_err}")
        
        # 3. Update database
        try:
            supabase.table("player_groups").update({
                "phone_number": phone_number,
                "twilio_sid": sid
            }).eq("group_id", group_id).execute()
        except Exception as db_err:
            print(f"[TWILIO] Group DB update failed: {db_err}. RECORDING ROLLBACK.")
            # PROVISIONING GUARD: Release the number if we can't save it to the DB
            try:
                client.incoming_phone_numbers(sid).delete()
                print(f"[TWILIO] Provisioning Guard: Released orphaned number {phone_number} due to DB failure.")
            except Exception as release_err:
                print(f"[TWILIO] CRITICAL: Provisioning Guard failed to release {phone_number}: {release_err}")
            raise db_err
        
        return True, phone_number
    except Exception as e:
        print(f"[TWILIO] Group Provisioning error: {e}")
        return False, str(e)

def provision_club_number(club_id, phone_number):
    """Purchase a number and link it to the club and messaging service."""
    client = get_twilio_client()
    print(f"[DEBUG] Provisioning club {club_id} number {phone_number}")
    # Fetch and sanitize config
    webhook_url = os.environ.get("TWILIO_WEBHOOK_URL", "").strip()
    messaging_service_sid = os.environ.get("TWILIO_MESSAGING_SERVICE_SID", "").strip()
    
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Purchase the number and configure webhooks directly
        friendly_name = phone_number
        try:
            name_res = supabase.table("clubs").select("name").eq("club_id", club_id).single().execute()
            if name_res.data and name_res.data.get("name"):
                club_name = name_res.data["name"]
                friendly_name = f"{format_phone_number(phone_number)} ({club_name})"
        except Exception as e:
            print(f"[TWILIO] Name fetch error for club {club_id}: {e}")

        params = {
            "phone_number": phone_number,
            "friendly_name": friendly_name
        }
        if webhook_url:
            params["sms_url"] = webhook_url
            params["sms_method"] = "POST"
            
        purchased = client.incoming_phone_numbers.create(**params)
        sid = purchased.sid
        
        # 2. Add to Messaging Service (if configured)
        if messaging_service_sid:
            try:
                client.messaging.v1.services(messaging_service_sid) \
                    .phone_numbers.create(phone_number_sid=sid)
            except Exception as ms_err:
                print(f"[TWILIO] MS Error (continuing): {ms_err}")
        
        # 3. Update database
        try:
            supabase.table("clubs").update({
                "phone_number": phone_number,
                "twilio_sid": sid
            }).eq("club_id", club_id).execute()
        except Exception as db_err:
            print(f"[TWILIO] Club DB update failed: {db_err}. RECORDING ROLLBACK.")
            # PROVISIONING GUARD: Release the number if we can't save it to the DB
            try:
                client.incoming_phone_numbers(sid).delete()
                print(f"[TWILIO] Provisioning Guard: Released orphaned number {phone_number} due to DB failure.")
            except Exception as release_err:
                print(f"[TWILIO] CRITICAL: Provisioning Guard failed to release {phone_number}: {release_err}")
            raise db_err
        
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
        try:
            res = supabase.table("clubs").select("twilio_sid").eq("club_id", club_id).maybe_single().execute()
        except Exception as sel_err:
            err_str = str(sel_err)
            # Handle the specific 204 "Missing response" error (Success but no content)
            # Distinguish from PGRST204 (Column missing)
            if 'PGRST204' in err_str:
                # This is a structural error (column missing), not a successful "No SID"
                print(f"[TWILIO] ERROR: 'twilio_sid' column missing in clubs schema.")
                raise sel_err
            if '204' in err_str or 'Missing response' in err_str:
                print(f"[TWILIO] Select hit 204 (Success - No Content) for club {club_id}.")
                return False, "No active number found (204)"
            raise sel_err

        if not res.data or not res.data.get("twilio_sid"):
            return False, "No active number found for this club"
        
        sid = res.data["twilio_sid"]
        
        # 2. Release in Twilio
        try:
            client.incoming_phone_numbers(sid).delete()
        except Exception as twilio_err:
            print(f"[TWILIO] Twilio API call failed (might already be deleted): {twilio_err}")
        
        # 3. Clear database
        try:
            supabase.table("clubs").update({
                "twilio_sid": None
            }).eq("club_id", club_id).execute()
        except Exception as db_err:
            err_str = str(db_err)
            # Check if this is just a 204 response which we can ignore
            if '204' in err_str or 'Missing response' in err_str:
                pass # Operation likely succeeded but returned 204
            else:
                print(f"[TWILIO] DB update failed for club {club_id}: {db_err}")
        
        return True, "Number release handled"
    except Exception as e:
        print(f"[TWILIO] Release error for club {club_id}: {e}")
        return False, str(e)

def release_group_number(group_id):
    """Release a purchased number and clear it from the group."""
    client = get_twilio_client()
    if not client:
        return False, "Twilio configuration error"
    
    try:
        # 1. Get the SID from the database
        try:
            res = supabase.table("player_groups").select("twilio_sid").eq("group_id", group_id).maybe_single().execute()
        except Exception as sel_err:
            err_str = str(sel_err)
            if '204' in err_str or 'Missing response' in err_str:
                return False, "No active number found (204)"
            raise sel_err

        if not res.data or not res.data.get("twilio_sid"):
            return False, "No active number found for this group"
        
        sid = res.data["twilio_sid"]
        
        # 2. Release in Twilio
        try:
            client.incoming_phone_numbers(sid).delete()
        except Exception as twilio_err:
            print(f"[TWILIO] Twilio API call failed (might already be deleted): {twilio_err}")
        
        # 3. Clear database
        try:
            supabase.table("player_groups").update({
                "twilio_sid": None
            }).eq("group_id", group_id).execute()
        except Exception as db_err:
            err_str = str(db_err)
            if '204' in err_str or 'Missing response' in err_str:
                pass
            else:
                print(f"[TWILIO] DB update failed for group {group_id}: {db_err}")
        
        return True, "Number release handled"
    except Exception as e:
        print(f"[TWILIO] Release error for group {group_id}: {e}")
        return False, str(e)
