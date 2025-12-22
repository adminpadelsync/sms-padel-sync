import time
from sms_handler import handle_incoming_sms
from matchmaker import find_and_invite_players
from database import supabase
from redis_client import clear_user_state

# Mock SMS
def mock_send_sms(to, body):
    print(f"\n[SMS to {to}]: {body}")

import sms_handler
import matchmaker
sms_handler.send_sms = mock_send_sms
matchmaker.send_sms = mock_send_sms

# Test Data
P1_PHONE = "+15550000001" # Requester
P2_PHONE = "+15550000002" # Voter 1
P3_PHONE = "+15550000003" # Voter 2
P4_PHONE = "+15550000004" # Voter 3

def setup_players():
    print("--- Setting up Players ---")
    # Clear DB (Order matters due to FKs)
    supabase.table("match_votes").delete().neq("vote_id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("match_invites").delete().neq("invite_id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("matches").delete().neq("match_id", "00000000-0000-0000-0000-000000000000").execute()
    
    for p in [P1_PHONE, P2_PHONE, P3_PHONE, P4_PHONE]:
        clear_user_state(p)
        supabase.table("players").delete().eq("phone_number", p).execute()

    # Create Club
    club_res = supabase.table("clubs").select("club_id").limit(1).execute()
    club_id = club_res.data[0]["club_id"]

    # Create 4 Players (Level 3.5)
    players = []
    for i, phone in enumerate([P1_PHONE, P2_PHONE, P3_PHONE, P4_PHONE]):
        p_data = {
            "phone_number": phone,
            "name": f"Player {i+1}",
            "declared_skill_level": 3.5,
            "adjusted_skill_level": 3.5,
            "availability_preferences": {"text": "Anytime"},
            "club_id": club_id,
            "active_status": True
        }
        res = supabase.table("players").insert(p_data).execute()
        players.append(res.data[0])
        print(f"Created {p_data['name']}")
    
    return players

def test_voting_flow():
    players = setup_players()
    p1 = players[0]
    
    print("\n--- 1. Player 1 Requests Range ---")
    handle_incoming_sms(P1_PHONE, "PLAY")
    # Request Friday 2pm-6pm (2 slots: 14:00, 16:00)
    handle_incoming_sms(P1_PHONE, "2023-12-08 14:00-18:00")
    
    # Verify Match Created
    matches_res = supabase.table("matches").select("*").contains("team_1_players", [p1["player_id"]]).order("created_at", desc=True).limit(1).execute()
    match = matches_res.data[0]
    print(f"Match Created: {match['match_id']}")
    print(f"Status: {match['status']}")
    print(f"Options: {match['voting_options']}")
    
    print("\n--- 2. Players Vote ---")
    # P2 votes for A (14:00)
    print(f"\n> Player 2 ({P2_PHONE}) texts 'A'")
    handle_incoming_sms(P2_PHONE, "A")
    
    # P3 votes for A and B
    print(f"\n> Player 3 ({P3_PHONE}) texts 'AB'")
    handle_incoming_sms(P3_PHONE, "AB")
    
    # P4 votes for A (Should confirm A)
    print(f"\n> Player 4 ({P4_PHONE}) texts 'A'")
    handle_incoming_sms(P4_PHONE, "A")
    
    print("\n--- 3. Verify Confirmation ---")
    updated_match = supabase.table("matches").select("*").eq("match_id", match['match_id']).execute().data[0]
    print(f"Status: {updated_match['status']}")
    print(f"Scheduled: {updated_match['scheduled_time']}")
    
    if updated_match['status'] == 'confirmed' and "14:00" in updated_match['scheduled_time']:
        print("SUCCESS: Match Confirmed for 14:00!")
    else:
        print("FAILURE: Match not confirmed correctly")

if __name__ == "__main__":
    test_voting_flow()
