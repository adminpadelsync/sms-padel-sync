import sys
import os
from datetime import datetime

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import supabase

def audit_match_data():
    print("--- Starting Match Data Audit ---")
    
    # 1. Fetch matches with results
    res = supabase.table("matches").select("*").filter("status", "in", '("completed", "confirmed")').execute()
    matches = res.data or []
    print(f"Auditing {len(matches)} matches...")
    
    anomalies = []
    
    for m in matches:
        mid = m["match_id"]
        score = m.get("score_text")
        winner = m.get("winner_team")
        scheduled = m.get("scheduled_time")
        
        # Check 1: Missing scores for completed matches
        if m["status"] == "completed" and not score:
            anomalies.append({
                "match_id": mid,
                "issue": "Missing score_text for completed match",
                "details": f"Winner: Team {winner}"
            })
            
        # Check 2: Missing winner for completed matches with scores
        if score and winner is None:
            anomalies.append({
                "match_id": mid,
                "issue": "Score exists but winner_team is NULL",
                "details": f"Score: {score}"
            })
            
        # Check 3: Anomalous future dates (beyond today)
        try:
            scheduled_dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
            if scheduled_dt.year > 2026:
                anomalies.append({
                    "match_id": mid,
                    "issue": "Anomalous future date",
                    "details": f"Scheduled: {scheduled}"
                })
        except:
            pass

    if not anomalies:
        print("✅ No major discrepancies found in match data.")
    else:
        print(f"⚠️ Found {len(anomalies)} anomalies:")
        for a in anomalies:
            print(f"- Match {a['match_id']}: {a['issue']} ({a['details']})")

if __name__ == "__main__":
    audit_match_data()
