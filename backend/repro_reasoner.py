import os
import json
from dotenv import load_dotenv
from logic.reasoner import reason_message

load_dotenv()

def test_reasoner():
    message = "Yes"
    state = "IDLE"
    player = {"name": "Test Player", "player_id": "test-id"}
    
    print(f"Testing Reasoner with message: '{message}' and state: '{state}'")
    result = reason_message(message, state, player)
    print("\n--- Result ---")
    print(f"Intent: {result.intent}")
    print(f"Confidence: {result.confidence}")
    print(f"Reply: {result.reply_text}")
    print(f"Raw: {result.raw_reply}")

if __name__ == "__main__":
    test_reasoner()
