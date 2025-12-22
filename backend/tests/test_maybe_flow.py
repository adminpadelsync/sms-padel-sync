import time
from sms_handler import handle_incoming_sms
from redis_client import clear_user_state
from database import supabase
import sms_handler 

# Mocks
P1_PHONE = "+15551111111"
P2_PHONE = "+15552222222"
MATCH_ID = None

captured_sms = []

def mock_send_sms(to, body):
    print(f"\n[SMS to {to}]: {body}")
    captured_sms.append({"to": to, "body": body})

sms_handler.send_sms = mock_send_sms

def setup_test_data():
    global MATCH_ID
    print("--- Setting up test data ---")
    
    # 1. Create Club (if needed, usually one exists)
    club_res = supabase.table("clubs").select("club_id").limit(1).execute()
    if not club_res.data:
        print("No club found, cannot run test.")
        return False
    club_id = club_res.data[0]["club_id"]
    
    # 2. Create Players
    players = [
        {"phone_number": P1_PHONE, "name": "Maybe Player", "club_id": club_id, "declared_skill_level": 3.0, "active_status": True},
        {"phone_number": P2_PHONE, "name": "Yes Player", "club_id": club_id, "declared_skill_level": 3.0, "active_status": True}
    ]
    
    for p in players:
        # Delete if exists
        supabase.table("players").delete().eq("phone_number", p["phone_number"]).execute()
        # Insert
        res = supabase.table("players").insert(p).execute()
        if not res.data:
             print(f"Failed to create player {p['name']}")
             return False
        # Store ID
        p["player_id"] = res.data[0]["player_id"]

    p1_id = players[0]["player_id"] # The one in memory dict, not the row. 
    # Actually we need to fetch the IDs.
    
    p1 = supabase.table("players").select("player_id").eq("phone_number", P1_PHONE).execute().data[0]
    p2 = supabase.table("players").select("player_id").eq("phone_number", P2_PHONE).execute().data[0]
    
    # 3. Create Match
    match_data = {
        "club_id": club_id,
        "team_1_players": [],
        "team_2_players": [],
        "scheduled_time": "2025-01-01 10:00:00",
        "status": "pending"
    }
    m_res = supabase.table("matches").insert(match_data).execute()
    MATCH_ID = m_res.data[0]["match_id"]
    print(f"Created Match: {MATCH_ID}")
    
    # 4. Create Invites
    invites = [
        {"match_id": MATCH_ID, "player_id": p1["player_id"], "status": "sent"},
        {"match_id": MATCH_ID, "player_id": p2["player_id"], "status": "sent"}
    ]
    supabase.table("match_invites").insert(invites).execute()
    print("Created Invites")
    return True

def test_maybe_logic():
    global captured_sms
    captured_sms = []
    
    print("\n--- Testing MAYBE Logic ---")
    
    # 1. P1 replies MAYBE
    print(f"\n> {P1_PHONE} sends: MAYBE")
    handle_incoming_sms(P1_PHONE, "MAYBE")
    
    # Verify DB
    p1 = supabase.table("players").select("player_id").eq("phone_number", P1_PHONE).execute().data[0]
    inv = supabase.table("match_invites").select("status").eq("match_id", MATCH_ID).eq("player_id", p1["player_id"]).execute().data[0]
    
    if inv["status"] == "maybe":
        print("SUCCESS: Invite status updated to 'maybe'")
    else:
        print(f"FAILURE: Invite status is {inv['status']}")
        
    # Verify SMS response
    # Expect: "Got it, we'll keep you updated..."
    found = False
    for sms in captured_sms:
        if sms["to"] == P1_PHONE and "keep you updated" in sms["body"]:
            print("SUCCESS: Confirmation SMS sent")
            found = True
            break
    if not found:
        print("FAILURE: Validation SMS not found")

    # Clear sms
    captured_sms = []
    
    # 2. P2 replies YES
    print(f"\n> {P2_PHONE} sends: YES")
    handle_incoming_sms(P2_PHONE, "YES")
    
    # Verify P1 Notification
    # Expect: "Update: Yes Player just joined! 3 spots left."
    found = False
    for sms in captured_sms:
        if sms["to"] == P1_PHONE and "just joined" in sms["body"]:
             print(f"SUCCESS: P1 notified: {sms['body']}")
             found = True
             break
    if not found:
        print("FAILURE: P1 was NOT notified")

if __name__ == "__main__":
    if setup_test_data():
        test_maybe_logic()
