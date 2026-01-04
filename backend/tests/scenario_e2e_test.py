import sys
import os
from datetime import datetime, timedelta
import json
import uuid
import time
from unittest.mock import MagicMock, patch

# Add backend to path - detect automatically based on script location
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir) # tests is a subfolder of backend
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# --- 1. MOCKING INFRASTRUCTURE ---
# Mock modules that require external connections or specific environments
mock_redis_data = {}

def mock_get_redis():
    mock = MagicMock()
    def hset(key, field, value):
        if key not in mock_redis_data:
            mock_redis_data[key] = {}
        mock_redis_data[key][field] = str(value)
    def hgetall(key):
        return mock_redis_data.get(key, {})
    def delete(key):
        if key in mock_redis_data:
            del mock_redis_data[key]
    def expire(key, time):
        pass
    
    mock.hset.side_effect = hset
    mock.hgetall.side_effect = hgetall
    mock.delete.side_effect = delete
    mock.expire.side_effect = expire
    return mock

# Apply mocks before importing handlers
sys.modules["redis"] = MagicMock()
mock_redis_client = mock_get_redis()

with patch("redis_client.get_redis_client", return_value=mock_redis_client):
    from database import supabase
    from sms_handler import handle_incoming_sms
    from twilio_client import set_dry_run, get_dry_run_responses
    import sms_constants as msg
    from logic_utils import get_now_utc, format_sms_datetime, parse_iso_datetime

# --- 2. TEST SETUP & CLEANUP ---
TEST_CLUB_NAME = f"E2E Test Club {int(time.time())}"
TEST_PLAYER_PHONE = f"+1999{int(time.time())}"
TEST_GROUP_NAME = "Test Group"

class ScenarioTester:
    def __init__(self):
        self.club_id = None
        self.group_id = None
        self.player_id = None
        self.match_id = None
        self.other_player_ids = []
        self.twilio_number = "+15550001234"

    def cleanup_club(self, club_id):
        """Helper to delete all club data in correct order."""
        # 1. Delete match related data
        match_ids_res = supabase.table("matches").select("match_id").eq("club_id", club_id).execute()
        match_ids = [m["match_id"] for m in (match_ids_res.data or [])]
        
        if match_ids:
            supabase.table("match_invites").delete().in_("match_id", match_ids).execute()
            supabase.table("feedback_requests").delete().in_("match_id", match_ids).execute()
            supabase.table("match_feedback").delete().in_("match_id", match_ids).execute()
            supabase.table("player_rating_history").delete().in_("match_id", match_ids).execute()
            supabase.table("matches").delete().in_("match_id", match_ids).execute()
        
        # 2. Delete groups
        supabase.table("player_groups").delete().eq("club_id", club_id).execute()
        
        # 3. Delete club memberships
        supabase.table("club_members").delete().eq("club_id", club_id).execute()
        
        # 4. Delete the club
        supabase.table("clubs").delete().eq("club_id", club_id).execute()

    def setup_club_and_group(self):
        # Pre-cleanup: delete any existing club with this phone number
        existing = supabase.table("clubs").select("club_id").eq("phone_number", self.twilio_number).execute()
        if existing.data:
            print(f"--- PRE-CLEANUP: Found existing club with {self.twilio_number}, deleting... ---")
            self.cleanup_club(existing.data[0]["club_id"])

        print(f"--- Setting up Test Club: {TEST_CLUB_NAME} ---")
        club_res = supabase.table("clubs").insert({
            "name": TEST_CLUB_NAME,
            "active": True,
            "phone_number": self.twilio_number,
            "timezone": "America/New_York", # EST
            "court_count": 4,
            "booking_system": "Playtomic"
        }).execute()
        self.club_id = club_res.data[0]["club_id"]

        print(f"--- Setting up Test Group: {TEST_GROUP_NAME} ---")
        group_res = supabase.table("player_groups").insert({
            "club_id": self.club_id,
            "name": TEST_GROUP_NAME,
            "visibility": "public"
        }).execute()
        self.group_id = group_res.data[0]["group_id"]

    def cleanup(self):
        print("\n--- CLEANUP: Deleting everything ---")
        if self.club_id:
            self.cleanup_club(self.club_id)
        
        # Also cleanup players if they were created
        if self.player_id:
            supabase.table("player_rating_history").delete().eq("player_id", self.player_id).execute()
            supabase.table("players").delete().eq("player_id", self.player_id).execute()
        
        for pid in self.other_player_ids:
             supabase.table("players").delete().eq("player_id", pid).execute()
        
        print("✅ Cleanup complete.")

    def simulate_sms(self, body: str, from_num: str = TEST_PLAYER_PHONE):
        print(f"\n[USER -> SMS]: {body}")
        with patch("redis_client.get_redis_client", return_value=mock_redis_client):
            result = handle_incoming_sms(
                from_number=from_num,
                body=body,
                to_number=self.twilio_number,
                dry_run=True
            )
        
        responses = result.get("responses", [])
        for r in responses:
            print(f"[SMS -> USER]: {r['body']}")
        return responses

# --- 3. THE SCENARIO ---
def run_scenario():
    tester = ScenarioTester()
    try:
        tester.setup_club_and_group()

        # 1. Start Onboarding
        tester.simulate_sms("start")
        
        # 2. Provide Name
        tester.simulate_sms("John E2E")
        
        # 3. Provide Skill Level (3.5)
        tester.simulate_sms("C")
        
        # 4. Provide Gender (Male)
        tester.simulate_sms("M")
        
        # 5. Join Group (Test Group should be #1)
        tester.simulate_sms("1")
        
        # 6. Set Availability (Anytime)
        tester.simulate_sms("G")

        # Verify Onboarding
        player_res = supabase.table("players").select("*").eq("phone_number", TEST_PLAYER_PHONE).execute()
        if not player_res.data:
            raise Exception("Player not found after onboarding")
        tester.player_id = player_res.data[0]["player_id"]
        print(f"✅ Player onboarded with ID: {tester.player_id}")

        # 7. Ask to play tomorrow at 6pm
        tomorrow = datetime.now() + timedelta(days=1)
        # We'll use natural language that the reasoner/parser should handle
        tomorrow_str = tomorrow.strftime("%A")
        tester.simulate_sms(f"let's play {tomorrow_str} at 6pm")

        # 8. Confirm the match
        # The system asks: 1) Everyone, 2) Test Group. We select 2.
        tester.simulate_sms("2")

        # Get match_id
        match_res = supabase.table("matches").select("*").eq("originator_id", tester.player_id).order("created_at", desc=True).limit(1).execute()
        if not match_res.data:
            raise Exception("Match not created")
        tester.match_id = match_res.data[0]["match_id"]
        print(f"✅ Match created: {tester.match_id}")

        # 9. Simulate 3 other users joining
        print("\n--- Simulating 3 other players joining ---")
        other_names = ["Alice", "Bob", "Charlie"]
        for i, name in enumerate(other_names):
            p_phone = f"+1888{int(time.time())}{i}"
            p_res = supabase.table("players").insert({
                "name": name,
                "phone_number": p_phone,
                "declared_skill_level": 3.5,
                "adjusted_skill_level": 3.5,
                "active_status": True
            }).execute()
            pid = p_res.data[0]["player_id"]
            tester.other_player_ids.append(pid)
            supabase.table("club_members").insert({"club_id": tester.club_id, "player_id": pid}).execute()
            
            # Manually add to team
            match_data = supabase.table("matches").select("*").eq("match_id", tester.match_id).execute().data[0]
            team_1 = match_data["team_1_players"] or []
            team_2 = match_data["team_2_players"] or []
            
            if len(team_1) < 2:
                team_1.append(pid)
            else:
                team_2.append(pid)
            
            supabase.table("matches").update({
                "team_1_players": team_1,
                "team_2_players": team_2,
                "status": "confirmed" if (len(team_1) + len(team_2)) == 4 else "pending"
            }).eq("match_id", tester.match_id).execute()
            print(f"Added {name} to match.")

        # 10. Verify Match Status
        final_match = supabase.table("matches").select("*").eq("match_id", tester.match_id).execute().data[0]
        print(f"✅ Match status: {final_match['status']} with {len(final_match['team_1_players'] or []) + len(final_match['team_2_players'] or [])} players")
        
        # 11. Trigger Result Nudge & Feedback
        # We'll simulate the match as having happened in the past for this part
        past_time = (datetime.utcnow() - timedelta(hours=3)).isoformat()
        supabase.table("matches").update({"scheduled_time": past_time}).eq("match_id", tester.match_id).execute()
        
        print("\n--- Triggering Post-Match Flow ---")
        from result_nudge_scheduler import send_result_nudge_for_match
        from feedback_scheduler import send_feedback_requests_for_match
        
        send_result_nudge_for_match(final_match)
        send_feedback_requests_for_match(final_match)

        # 12. Simulate Result Response ("We won 6-4 6-2")
        tester.simulate_sms("We won 6-4 6-2")
        
        # 13. Simulate Feedback ("9 8 7")
        tester.simulate_sms("9 8 7")

        # 14. Final Data Verification
        match_final = supabase.table("matches").select("*").eq("match_id", tester.match_id).execute().data[0]
        print(f"\n--- FINAL DATA REVIEW ---")
        print(f"Match Status: {match_final['status']}")
        print(f"Score: {match_final['score_text']}")
        print(f"Winner: Team {match_final['winner_team']}")
        
        feedback_res = supabase.table("match_feedback").select("*").eq("match_id", tester.match_id).execute()
        print(f"Feedback Records: {len(feedback_res.data)}")
        
        print("\n✅ ALL STEPS PASSED SUCCESSFULLY!")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        input("\nPress Enter to DELETE everything and exit...")
        tester.cleanup()

if __name__ == "__main__":
    run_scenario()
