import sys
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# Mock modules that are missing in the environment
sys.modules["pytz"] = MagicMock()
sys.modules["twilio"] = MagicMock()
sys.modules["twilio.rest"] = MagicMock()
sys.modules["redis"] = MagicMock()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock dependencies
sys.modules["twilio_client"] = MagicMock()
sys.modules["redis_client"] = MagicMock()

from database import supabase
from handlers.result_handler import handle_result_report
from logic.reasoner import ReasonerResult

def test_result_handler():
    print("Testing ResultHandler directly...")
    
    # 1. Setup Test Data
    club_name = "Handler Test Club " + datetime.now().strftime("%H%M%S")
    club_id = supabase.table("clubs").insert({
        "name": club_name, 
        "active": True,
        "court_count": 4,
        "phone_number": f"+1999{datetime.now().strftime('%H%M%S')}"
    }).execute().data[0]["club_id"]
    
    p_ids = []
    names = ["Alice", "Bob", "Charlie", "Dave"]
    phones = [f"+1888{datetime.now().strftime('%H%M%S')}{i}" for i in range(4)]
    for i, name in enumerate(names):
        pid = supabase.table("players").insert({
            "phone_number": phones[i],
            "name": name,
            "elo_rating": 1700,
            "elo_confidence": 1,
            "active_status": True,
            "declared_skill_level": 3.0,
            "adjusted_skill_level": 3.0
        }).execute().data[0]["player_id"]
        p_ids.append(pid)
        
        # Add to club_members
        supabase.table("club_members").insert({
            "club_id": club_id,
            "player_id": pid
        }).execute()

    # Create match
    match_id = supabase.table("matches").insert({
        "club_id": club_id,
        "status": "confirmed",
        "scheduled_time": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "originator_id": p_ids[0]
    }).execute().data[0]["match_id"]
    
    # Add participants
    participants = []
    for i in range(4):
        participants.append({
            "match_id": match_id,
            "player_id": p_ids[i],
            "team_index": 1 if i < 2 else 2,
            "status": "confirmed"
        })
    supabase.table("match_participations").insert(participants).execute()
    
    # 2. Mock Reasoner Result
    # User says: "Me and Bob beat Charlie and Dave 6-4"
    mock_reasoner_result = ReasonerResult(
        intent="REPORT_RESULT",
        entities={
            "winner": "Team A",
            "team_a": ["Me", "Bob"],
            "team_b": ["Charlie", "Dave"],
            "score": "6-4"
        },
        confidence=0.9,
        raw_reply="Alice reporting result"
    )

    # 3. Call Handler
    print("Calling handle_result_report...")
    alice_player = supabase.table("players").select("*").eq("player_id", p_ids[0]).execute().data[0]
    handle_result_report(
        from_number=phones[0], # From Alice
        player=alice_player,
        entities=mock_reasoner_result.entities,
        cid=club_id
    )
        
    # 4. Verify Database
    match_final = supabase.table("matches").select("*").eq("match_id", match_id).execute().data[0]
    assert match_final["status"] == "completed"
    assert match_final["winner_team"] == 1
    assert match_final["score_text"] == "6-4"
    print("✅ Match updated to completed")
    
    p1 = supabase.table("players").select("elo_rating, elo_confidence, adjusted_skill_level").eq("player_id", p_ids[0]).execute().data[0]
    p3 = supabase.table("players").select("elo_rating, elo_confidence, adjusted_skill_level").eq("player_id", p_ids[2]).execute().data[0]
    
    print(f"P1 Elo: {p1['elo_rating']} (conf: {p1['elo_confidence']}, rank: {p1['adjusted_skill_level']})")
    print(f"P3 Elo: {p3['elo_rating']} (conf: {p3['elo_confidence']}, rank: {p3['adjusted_skill_level']})")
    
    assert p1["elo_rating"] > 1700
    assert p1["elo_confidence"] == 2
    assert p1["adjusted_skill_level"] > 3.0
    assert p3["elo_rating"] < 1700
    assert p3["elo_confidence"] == 2
    assert p3["adjusted_skill_level"] < 3.0
    
    print("✅ Elo and Sync Ratings updated correctly!")
    return True

if __name__ == "__main__":
    try:
        if test_result_handler():
            print("\nRESULT HANDLER TEST PASSED!")
        else:
            print("\nRESULT HANDLER TEST FAILED!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
