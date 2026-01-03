import os
from database import supabase
import json

def add_golden_sample():
    print("Adding 'One Team Result' Golden Sample...")
    
    sample = {
        "name": "One Team Result Report",
        "initial_state": "IDLE",
        "steps": [
            {
                "role": "user",
                "message": "Mike and Adam won 6-2 6-3 7-5",
                "thought": "The user is reporting a match result. They only mentioned the winners (Mike and Adam) and the score. I should extract Mike and Adam as team_a and keep team_b empty, and set the intent to REPORT_RESULT.",
                "intent": "REPORT_RESULT",
                "entities": {
                    "score": "6-2 6-3 7-5",
                    "winner": "Mike and Adam",
                    "team_a": ["Mike", "Adam"],
                    "team_b": []
                },
                "reply_text": "🎾 Result recorded: 6-2 6-3 7-5. Your Sync Rating has been updated! 📈"
            }
        ]
    }
    
    try:
        # Check if already exists
        existing = supabase.table("reasoner_test_cases").select("id").eq("name", sample["name"]).execute()
        if existing.data:
            print(f"Sample '{sample['name']}' already exists. Updating...")
            supabase.table("reasoner_test_cases").update(sample).eq("name", sample["name"]).execute()
        else:
            supabase.table("reasoner_test_cases").insert(sample).execute()
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_golden_sample()
