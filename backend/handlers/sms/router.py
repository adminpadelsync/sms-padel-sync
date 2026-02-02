import re
from typing import Optional, Tuple, Dict
from database import supabase
from twilio_client import set_reply_from, set_club_name, send_sms

def resolve_club_context(from_number: str, to_number: str = None, club_id: str = None) -> Tuple[str, str, str, str, str]:
    """
    Resolve the context of the message (Club, Group, Booking System).
    
    Returns:
        (str(club_id), str(club_name), str(group_id) if group_id else None, str(group_name) if group_name else None, str(booking_system))
    """
    
    # Initialize defaults
    club_name = "the club"
    group_id = None
    group_name = None
    booking_system = "Playtomic"

    # Set reply-from context early if possible
    from twilio_client import normalize_phone_number
    to_number = normalize_phone_number(to_number)
    
    if to_number:
        set_reply_from(to_number)

    # 1. Explicit club_id (e.g. from Training Jig)
    if club_id:
        club_res = supabase.table("clubs").select("name, booking_system, phone_number").eq("club_id", club_id).execute()
        if club_res.data:
            club_data = club_res.data[0]
            club_name = club_data["name"]
            booking_system = club_data.get("booking_system") or "Playtomic"
            
            # If to_number was missing, try to set it from club record
            if not to_number:
                to_number = normalize_phone_number(club_data.get("phone_number"))
                if to_number:
                    set_reply_from(to_number)
        return (club_id, club_name, group_id, group_name, booking_system)

    try:
        # 2. Lookup by To-Number (Group or Club)
        if to_number:
            import re
            digits = re.sub(r'\D', '', to_number)
            last_10_to = digits[-10:] if len(digits) >= 10 else digits

            print(f"[SMS] Resolving context for To-Number: {to_number} (last 10: {last_10_to})")

            # Check Group Number
            # We try exact match, then normalized match, then last 10 digits
            try:
                # Use quoted values for .or_ to handle special characters like '+'
                or_filter = f'phone_number.eq."{to_number}",phone_number.ilike.%{last_10_to}'
                group_res = supabase.table("player_groups").select("group_id, club_id, name, phone_number") \
                    .or_(or_filter) \
                    .execute()
                    
                if group_res.data:
                    # Sort matches to find the best one (exact match first)
                    best_group = None
                    for g in group_res.data:
                        g_phone = normalize_phone_number(g.get("phone_number"))
                        if g_phone == to_number:
                            best_group = g
                            break
                    
                    group = best_group or group_res.data[0]
                    group_id = group["group_id"]
                    group_name = group["name"]
                    club_id = group["club_id"]
                    
                    # Fetch Club logic
                    club_res = supabase.table("clubs").select("name, booking_system, phone_number").eq("club_id", club_id).execute()
                    if club_res.data:
                        club_name = club_res.data[0]["name"]
                        booking_system = club_res.data[0].get("booking_system") or "Playtomic"
                        
                    print(f"[SMS] Dedicated Group Number detected: {group_name} ({club_name})")
                    return (str(club_id), club_name, str(group_id), group_name, booking_system)
            except Exception as e:
                print(f"[SMS ERROR] Group lookup failed: {e}")
                from error_logger import log_sms_error
                log_sms_error(f"Group lookup error: {str(e)}", from_number, f"To: {to_number}", exception=e)
            
            # Check Club Number
            try:
                or_filter = f'phone_number.eq."{to_number}",phone_number.ilike.%{last_10_to}'
                club_res = supabase.table("clubs").select("club_id, name, booking_system, phone_number") \
                    .or_(or_filter) \
                    .execute()
                    
                if club_res.data:
                    # Best match (exact)
                    best_club = None
                    for c in club_res.data:
                        c_phone = normalize_phone_number(c.get("phone_number"))
                        if c_phone == to_number:
                            best_club = c
                            break
                    
                    c = best_club or club_res.data[0]
                    print(f"[SMS] Club Number detected: {c['name']}")
                    return (str(c["club_id"]), c["name"], None, None, c.get("booking_system") or "Playtomic")
            except Exception as e:
                print(f"[SMS ERROR] Club lookup failed: {e}")
                from error_logger import log_sms_error
                log_sms_error(f"Club lookup error: {str(e)}", from_number, f"To: {to_number}", exception=e)
            
            # Unknown/Unconfigured Number
            print(f"[WARNING] SMS received on unknown Twilio number {to_number}. Falling back to first available club.")

        # 3. Fallback (If no club found by to_number, or to_number missing)
        fallback = supabase.table("clubs").select("club_id, name, booking_system").order("created_at").limit(1).execute()
        if fallback.data:
            c = fallback.data[0]
            print(f"[SMS] Fallback to club: {c.get('name')}")
            return (str(c["club_id"]), c.get("name", "Padel Sync Club"), None, None, c.get("booking_system") or "Playtomic")
    except Exception as e:
        print(f"[CRITICAL] Internal Router Error: {e}")
        from error_logger import log_sms_error
        log_sms_error(f"Internal Router Error: {str(e)}", from_number, f"To: {to_number}", exception=e)
    
    # 4. Total failure (No clubs in DB at all)
    print(f"[CRITICAL] No clubs found in database. Cannot resolve context.")
    return (None, "the club", None, None, "Playtomic")


def resolve_player(from_number: str, club_id: str) -> Optional[Dict]:
    """
    Find player by phone number and verify club membership.
    Uses strict normalization match.
    """
    from twilio_client import normalize_phone_number
    normalized = normalize_phone_number(from_number)
    
    if not normalized:
        return None

    # Search for exactly the normalized number
    player_res = supabase.table("players").select("*") \
        .eq("phone_number", normalized) \
        .execute()
    
    potential_player = player_res.data[0] if player_res.data else None
    
    # If not found by full number, try last 10 as absolute backup (if database is still messy)
    if not potential_player:
        digits = re.sub(r'\D', '', from_number)
        last_10 = digits[-10:] if len(digits) >= 10 else digits
        if last_10:
            player_res = supabase.table("players").select("*").ilike("phone_number", f"%{last_10}").execute()
            potential_player = player_res.data[0] if player_res.data else None

    if potential_player:
        # Fetch memberships for this club
        memberships_res = supabase.table("group_memberships").select(
            "group_id, player_groups!inner(name, club_id)"
        ).eq("player_id", potential_player["player_id"]).eq("player_groups.club_id", club_id).execute()
        
        group_names = [m["player_groups"]["name"] for m in (memberships_res.data or [])]
        potential_player["group_names"] = group_names

        if club_id:
            member_res = supabase.table("club_members").select("*").eq("club_id", club_id).eq("player_id", potential_player["player_id"]).execute()
            if member_res.data:
                player = potential_player
                player["club_id"] = str(club_id) # Legacy support
                player["is_member"] = True
                return player
            else:
                # Fallback: if they are in a group in this club, they SHOULD be a member.
                if group_names:
                     print(f"[SMS] Player {from_number} is in groups for {club_id}, auto-resolving membership.")
                     potential_player["club_id"] = str(club_id)
                     potential_player["is_member"] = True
                     return potential_player

                print(f"[SMS] Player {from_number} exists but is not a member of club {club_id}")
                # Still attach club_id for context/settings, but keep it a 'lite' player
                potential_player["club_id"] = str(club_id)
                potential_player["is_member"] = False
                return potential_player
        else:
            potential_player["is_member"] = False
            return potential_player
            
    return None
