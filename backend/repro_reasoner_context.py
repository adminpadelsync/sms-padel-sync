import os
import json
from dotenv import load_dotenv
from logic.reasoner import reason_message

load_dotenv()

def test_reasoner_with_context():
    # Scenario: User has a pending match invite
    message = "Yes!"
    state = "IDLE"
    player = {"name": "Adam", "player_id": "test-id"}
    pending_context = [
        {
            "type": "MATCH_INVITE",
            "status": "sent",
            "match_time": "2026-01-07T08:00:00",
            "club_name": "South Beach Padel"
        }
    ]
    
    print(f"Testing Reasoner with message: '{message}' and Pending Context.")
    print(f"Context: {json.dumps(pending_context, indent=2)}")
    
    result = reason_message(message, state, player, pending_context=pending_context)
    
    print("\n--- Result ---")
    print(f"Intent: {result.intent}")
    print(f"Confidence: {result.confidence}")
    print(f"Reply: {result.reply_text}")
    print(f"Reasoning: {getattr(result, 'reasoning', 'N/A')}")
    print(f"Raw: {result.raw_reply}")

    if result.intent == "ACCEPT_INVITE":
        print("\n✅ SUCCESS: Reasoner correctly identified ACCEPT_INVITE with context.")
    else:
        print("\n❌ FAILURE: Reasoner failed to identify context.")

if __name__ == "__main__":
    test_reasoner_with_context()
