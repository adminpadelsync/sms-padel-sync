from database import supabase
import json

try:
    # Test RPC call with dummy data
    # Note: This might fail with 400 if parameters are wrong, but we want to see if it even exists
    res = supabase.rpc("attempt_insert_invite", {
        "p_match_id": "00000000-0000-0000-0000-000000000000",
        "p_player_id": "00000000-0000-0000-0000-000000000000",
        "p_status": "sent",
        "p_batch_number": 1,
        "p_sent_at": "2026-01-19T14:30:00Z",
        "p_expires_at": "2026-01-19T14:45:00Z",
        "p_invite_score": 0.0,
        "p_score_breakdown": {}
    }).execute()
    print("RPC exists (but failed as expected with dummy IDs)")
except Exception as e:
    err = str(e)
    if "function" in err and "does not exist" in err:
        print("RPC attempt_insert_invite DOES NOT exist")
    else:
        print(f"RPC found but error occurred: {err}")
