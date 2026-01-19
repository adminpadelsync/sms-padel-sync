from typing import Optional, Tuple, Dict
from database import supabase
from twilio_client import set_reply_from, set_club_name, send_sms

def resolve_club_context(from_number: str, to_number: str = None, club_id: str = None) -> Tuple[str, str, str, str, str]:
    """
    Resolve the context of the message (Club, Group, Booking System).
    
    Returns:
        (club_id, club_name, group_id, group_name, booking_system)
    """
    
    # Initialize defaults
    club_name = "the club"
    group_id = None
    group_name = None
    booking_system = "Playtomic"

    # Set reply-from context early if possible
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
                to_number = club_data.get("phone_number")
                if to_number:
                    set_reply_from(to_number)
        return (club_id, club_name, group_id, group_name, booking_system)

    # 2. Lookup by To-Number (Group or Club)
    if to_number:
        # Check Group Number
        group_res = supabase.table("player_groups").select("group_id, club_id, name").eq("phone_number", to_number).execute()
        if group_res.data:
            group = group_res.data[0]
            group_id = group["group_id"]
            group_name = group["name"]
            club_id = group["club_id"]
            
            # Fetch Club logic
            club_res = supabase.table("clubs").select("name, booking_system").eq("club_id", club_id).execute()
            if club_res.data:
                club_name = club_res.data[0]["name"]
                booking_system = club_res.data[0].get("booking_system") or "Playtomic"
                
            print(f"[SMS] Dedicated Group Number detected: {group_name} ({club_name})")
            return (str(club_id), club_name, str(group_id), group_name, booking_system)
        
        # Check Club Number
        club_res = supabase.table("clubs").select("club_id, name, booking_system").eq("phone_number", to_number).execute()
        if club_res.data:
            c = club_res.data[0]
            return (str(c["club_id"]), c["name"], None, None, c.get("booking_system") or "Playtomic")
        
        # Unknown/Unconfigured Number
        print(f"[ERROR] SMS received on unknown Twilio number {to_number}. No club context found.")
        return (None, "the club", None, None, "Playtomic")

    # 3. Fallback (Only if to_number was NOT provided - e.g. manual trigger without number context)
    if not to_number:
        fallback = supabase.table("clubs").select("club_id, name, booking_system").limit(1).execute()
        if fallback.data:
            c = fallback.data[0]
            return (str(c["club_id"]), c.get("name", "the club"), None, None, c.get("booking_system") or "Playtomic")
    
    # 4. Total failure
    return (None, "the club", None, None, "Playtomic")


def resolve_player(from_number: str, club_id: str) -> Optional[Dict]:
    """
    Find player by phone number and verify club membership.
    """
    player_res = supabase.table("players").select("*").eq("phone_number", from_number).execute()
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
                print(f"[SMS] Player {from_number} exists but is not a member of club {club_id}")
                # Still attach club_id for context/settings, but keep it a 'lite' player
                potential_player["club_id"] = str(club_id)
                potential_player["is_member"] = False
                return potential_player
        else:
            potential_player["is_member"] = False
            return potential_player
            
    return None
