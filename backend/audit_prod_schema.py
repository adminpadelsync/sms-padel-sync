from database import supabase
import json

def check_field(table, field):
    try:
        supabase.table(table).select(field).limit(1).execute()
        return True
    except Exception as e:
        return False

def check_table(table):
    try:
        supabase.table(table).select("*").limit(1).execute()
        return True
    except Exception as e:
        return False

checks = {
    "tables": ["user_clubs", "club_members", "sms_outbox"],
    "matches_cols": ["court_booked", "originator_id", "booked_at", "result_nudge_count", "last_result_nudge_at"],
    "clubs_cols": ["twilio_sid", "timezone", "booking_slug"]
}

results = {}

for table in checks["tables"]:
    results[f"table_{table}"] = check_table(table)

for col in checks["matches_cols"]:
    results[f"matches_{col}"] = check_field("matches", col)

for col in checks["clubs_cols"]:
    results[f"clubs_{col}"] = check_field("clubs", col)

print(json.dumps(results, indent=2))
