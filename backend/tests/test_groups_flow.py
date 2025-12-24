import time
from sms_handler import handle_incoming_sms
from redis_client import clear_user_state
from database import supabase

TEST_PHONE = "+15550001111"

def mock_send_sms(to, body):
    print(f"\n[SMS to {to}]:\n{body}\n{'-'*20}")

# Monkey patch send_sms for testing
import twilio_client
twilio_client.send_sms = mock_send_sms

def test_groups_flow():
    print("--- Starting Groups SMS Flow Test ---")
    
    # 0. Setup: Ensure a club exists and get its ID
    club_res = supabase.table("clubs").select("club_id, phone_number").limit(1).execute()
    if not club_res.data:
        print("FAILURE: No club found in DB")
        return
    club = club_res.data[0]
    club_id = club["club_id"]
    club_phone = club["phone_number"]

    # 1. Cleanup previous test data
    clear_user_state(TEST_PHONE)
    
    # Get or create player for this club
    player_res = supabase.table("players").select("*").eq("phone_number", TEST_PHONE).eq("club_id", club_id).execute()
    if not player_res.data:
        # Create a test player
        player_res = supabase.table("players").insert({
            "phone_number": TEST_PHONE,
            "name": "Test Player",
            "club_id": club_id,
            "declared_skill_level": "3.5",
            "gender": "M"
        }).execute()
    
    player = player_res.data[0]
    player_id = player["player_id"]
    
    # Cleanup memberships for this player
    supabase.table("group_memberships").delete().eq("player_id", player_id).execute()
    
    # Ensure at least two public groups exist for this club
    groups_res = supabase.table("player_groups").select("*").eq("club_id", club_id).eq("visibility", "public").execute()
    if len(groups_res.data) < 2:
        # Create test groups
        supabase.table("player_groups").insert([
            {"name": "Test Group A", "club_id": club_id, "visibility": "public"},
            {"name": "Test Group B", "club_id": club_id, "visibility": "public"}
        ]).execute()
        groups_res = supabase.table("player_groups").select("*").eq("club_id", club_id).eq("visibility", "public").execute()

    print(f"\n--- Scenario 1: No groups joined ---")
    print("> User sends: 'GROUPS'")
    handle_incoming_sms(TEST_PHONE, "GROUPS", to_number=club_phone)
    
    print(f"\n--- Scenario 2: Join Group 1 ---")
    print("> User sends: '1'")
    handle_incoming_sms(TEST_PHONE, "1", to_number=club_phone)
    
    # Verify DB
    members_res = supabase.table("group_memberships").select("*").eq("player_id", player_id).execute()
    print(f"Player is now in {len(members_res.data)} group(s).")
    
    print(f"\n--- Scenario 3: User sends 'GROUPS' again (should show membership) ---")
    handle_incoming_sms(TEST_PHONE, "GROUPS", to_number=club_phone)
    
    print(f"\n--- Scenario 4: Leave Group 1 ---")
    print("> User sends: '1'")
    handle_incoming_sms(TEST_PHONE, "1", to_number=club_phone)
    
    # Verify DB
    members_res = supabase.table("group_memberships").select("*").eq("player_id", player_id).execute()
    print(f"Player is now in {len(members_res.data)} group(s).")

    print(f"\n--- Scenario 5: User sends 'GROUPS' again (should be back to initial state) ---")
    handle_incoming_sms(TEST_PHONE, "GROUPS", to_number=club_phone)

if __name__ == "__main__":
    test_groups_flow()
