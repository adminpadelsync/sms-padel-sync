import sys
from unittest.mock import MagicMock

# 1. Mock Redis BEFORE anything else
_test_state = {}
def mock_set_user_state(phone, state, data=None):
    _test_state[phone] = {"state": state}
    if data: _test_state[phone].update(data)
    print(f"[STATE] {phone} -> {state}")
def mock_get_user_state(phone):
    return _test_state.get(phone, {})
def mock_clear_user_state(phone):
    _test_state.pop(phone, None)

# Create a mock redis_client module
mock_redis = MagicMock()
mock_redis.set_user_state = mock_set_user_state
mock_redis.get_user_state = mock_get_user_state
mock_redis.clear_user_state = mock_clear_user_state
sys.modules["redis_client"] = mock_redis

# 2. Mock Reasoner BEFORE anything else
from logic.reasoner import ReasonerResult
def mock_reason_message(body, state, player, history=None, samples=None, pending_context=None):
    body_clean = body.upper().strip()
    if body_clean == "PLAY":
        return ReasonerResult("START_MATCH", 1.0, {})
    if ":" in body_clean or "-" in body_clean or "18:00" in body_clean:
        return ReasonerResult("UNKNOWN", 1.0, {"date": body_clean})
    if body_clean == "YES":
        if pending_context:
             return ReasonerResult("ACCEPT_INVITE", 1.0, {})
        return ReasonerResult("UNKNOWN", 1.0, {})
    return ReasonerResult("UNKNOWN", 1.0, {})

mock_reasoner = MagicMock()
mock_reasoner.reason_message = mock_reason_message
sys.modules["logic.reasoner"] = mock_reasoner

# 3. Now import the rest
import time
from sms_handler import handle_incoming_sms
from matchmaker import find_and_invite_players
from database import supabase

# Mock SMS
def mock_send_sms(to, body, **kwargs):
    print(f"\n[SMS to {to}]: {body}")

import sms_handler
import matchmaker
sms_handler.send_sms = mock_send_sms
matchmaker.send_sms = mock_send_sms

# Test Data
P1_PHONE = "+15550000001" # Requester
P2_PHONE = "+15550000002" # Invitee 1
P3_PHONE = "+15550000003" # Invitee 2
P4_PHONE = "+15550000004" # Invitee 3

def setup_players():
    print("--- Setting up Players ---")
    
    # Create Club
    club_res = supabase.table("clubs").select("club_id").limit(1).execute()
    if not club_res.data:
        # Create one if missing
        club_id = supabase.table("clubs").insert({
            "name": "Test Match Club",
            "phone_number": "+1122334455"
        }).execute().data[0]["club_id"]
    else:
        club_id = club_res.data[0]["club_id"]

    # Create 4 Players (Level 3.5)
    players = []
    for i, phone in enumerate([P1_PHONE, P2_PHONE, P3_PHONE, P4_PHONE]):
        # Cleanup dependencies first
        p_res = supabase.table("players").select("player_id").eq("phone_number", phone).execute()
        if p_res.data:
            pid = p_res.data[0]["player_id"]
            supabase.table("error_logs").delete().eq("player_id", pid).execute()
            supabase.table("match_participations").delete().eq("player_id", pid).execute()
            supabase.table("match_invites").delete().eq("player_id", pid).execute()
            supabase.table("club_members").delete().eq("player_id", pid).execute()
            supabase.table("group_memberships").delete().eq("player_id", pid).execute()
            supabase.table("player_rating_history").delete().eq("player_id", pid).execute()
            supabase.table("players").delete().eq("player_id", pid).execute()
        
        p_data = {
            "phone_number": phone,
            "name": f"Player {i+1}",
            "declared_skill_level": 3.5,
            "adjusted_skill_level": 3.5,
            "avail_weekday_morning": True,
            "active_status": True
        }
        res = supabase.table("players").insert(p_data).execute()
        player = res.data[0]
        players.append(player)
        print(f"Created {p_data['name']}")
        
        # Add to club_members
        supabase.table("club_members").insert({
            "club_id": club_id,
            "player_id": player["player_id"]
        }).execute()
    
    return players

def test_matchmaking():
    players = setup_players()
    p1 = players[0]
    
    print("\n--- 1. Player 1 Requests Match ---")
    handle_incoming_sms(P1_PHONE, "PLAY")
    handle_incoming_sms(P1_PHONE, "2023-12-05 18:00")
    handle_incoming_sms(P1_PHONE, "YES")
    
    # Verify Match Created
    # Find match where P1 is a participant
    parts = supabase.table("match_participations").select("match_id").eq("player_id", p1["player_id"]).execute()
    if not parts.data:
        print("❌ No match_participation found for P1!")
        return False
        
    match_id = parts.data[0]["match_id"]
    match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
    print(f"Match Created: {match['match_id']}")
    
    print("\n--- 2. Players Accept Invites ---")
    # Fetch invites to get pendings
    invites_res = supabase.table("match_invites").select("*").eq("match_id", match_id).execute()
    print(f"Invites sent: {len(invites_res.data)}")

    # Player 2 accepts
    handle_incoming_sms(P2_PHONE, "YES")
    # Player 3 accepts
    handle_incoming_sms(P3_PHONE, "YES")
    # Player 4 accepts (Should trigger confirmation)
    handle_incoming_sms(P4_PHONE, "YES")
    
    print("\n--- 3. Verify Match Confirmation ---")
    updated_match = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
    print(f"Status: {updated_match['status']}")
    
    p_final = supabase.table("match_participations").select("*").eq("match_id", match_id).execute().data
    team1 = [p for p in p_final if p["team_index"] == 1]
    team2 = [p for p in p_final if p["team_index"] == 2]
    print(f"Team 1 count: {len(team1)}")
    print(f"Team 2 count: {len(team2)}")
    
    if updated_match['status'] == 'confirmed' and len(p_final) == 4:
        print("✅ SUCCESS: Match Confirmed and Participations populated!")
        assert True
    else:
        print("❌ FAILURE: Match logic incomplete.")
        assert False

if __name__ == "__main__":
    if test_matchmaking():
        print("\nMATCHMAKING TEST PASSED!")
    else:
        print("\nMATCHMAKING TEST FAILED!")
        sys.exit(1)
