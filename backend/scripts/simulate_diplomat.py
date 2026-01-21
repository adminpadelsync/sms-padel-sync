
import sys
import os
import time
from datetime import datetime, timedelta

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import supabase
from handlers.sms.dispatcher import IntentDispatcher
from matchmaker import process_batch_refills, process_pending_matches, process_last_call_flash, find_and_invite_players
from logic_utils import get_now_utc, format_sms_datetime, parse_iso_datetime

def run_simulation():
    print("🚀 Starting 'The Diplomat' & 'Last Call' Simulation\n")
    
    # 1. Setup Context
    # Get a test club
    club_res = supabase.table("clubs").select("*").limit(1).execute()
    if not club_res.data:
        print("❌ No clubs found. Run populate_test_data.py first.")
        return
    club = club_res.data[0]
    club_id = club["club_id"]
    from_number = "+15550001111" # Organizer (Adam)
    
    # Ensure organizer exists in club
    organizer_res = supabase.table("players").select("*").eq("phone_number", from_number).execute()
    if not organizer_res.data:
        # Create organizer
        organizer_res = supabase.table("players").insert({
            "name": "Adam (Organizer)",
            "phone_number": from_number,
            "declared_skill_level": 4.0,
            "gender": "male",
            "active_status": True
        }).execute()
        supabase.table("club_members").insert({"player_id": organizer_res.data[0]["player_id"], "club_id": club_id}).execute()
    
    organizer = organizer_res.data[0]
    
    # Get 10 test players and ensure they are compatible (4.0 range, Male)
    players_res = supabase.table("players").select("*").neq("phone_number", from_number).limit(10).execute()
    players = players_res.data
    for p in players:
        supabase.table("players").update({
            "declared_skill_level": 4.0, 
            "adjusted_skill_level": 4.0,
            "gender": "male",
            "active_status": True,
            "muted_until": None
        }).eq("player_id", p["player_id"]).execute()
    
    # Clear any existing state for organizer and players
    from redis_client import clear_user_state
    clear_user_state(from_number)
    for p in players:
        clear_user_state(p["phone_number"])
    
    dispatcher = IntentDispatcher()
    
    # --- PHASE 1: Capture Alternative Availability ---
    print("--- Phase 1: Capturing Alternative Availability ---")
    
    # Create a match for 6:00 PM today
    print(f"Organizer: 'Play 6pm gender E'")
    res = dispatcher.handle_sms(from_number, "Play 6pm gender E", dry_run=True, club_id=club_id)
    print(f"System: {res['responses'][0]['body'] if res['responses'] else 'No response'}\n")
    
    # Force confirmation if needed (some state transitions require it)
    print(f"Organizer: 'YES'")
    res = dispatcher.handle_sms(from_number, "YES", dry_run=True, club_id=club_id)
    print(f"System: {res['responses'][0]['body'] if res['responses'] else 'No response'}\n")

    # Get the newly created match
    match_res = supabase.table("matches").select("*").eq("originator_id", organizer["player_id"]).order("created_at", desc=True).limit(1).execute()
    if not match_res.data:
        print("❌ Match creation failed.")
        return
    match = match_res.data[0]
    match_id = match["match_id"]
    match_time = parse_iso_datetime(match["scheduled_time"])
    
    # Invite players (should happen automatically in dispatcher, but let's be explicit)
    find_and_invite_players(match_id)
    
    # Get an invited player
    invite_res = supabase.table("match_invites").select("*, players(*)").eq("match_id", match_id).eq("status", "sent").execute()
    if not invite_res.data:
        print("❌ No invites sent. Check logs.")
        return
        
    player_to_decline = invite_res.data[0]["players"]
    print(f"Player {player_to_decline['name']}: 'I can't do 6pm, but I'm free at 7pm'")
    
    # Dispatch decline with alternative
    res = dispatcher.handle_sms(player_to_decline["phone_number"], "I can't do 6pm, but I'm free at 7pm", dry_run=True, club_id=club_id)
    print(f"System: {res['responses'][0]['body'] if res['responses'] else 'No response'}")
    print(f"Intent detected: {res['intent']} | Entities: {res['entities']}")
    
    # Verify DB update
    check_inv = supabase.table("match_invites").select("suggested_time").eq("invite_id", invite_res.data[0]["invite_id"]).execute()
    print(f"Captured Suggested Time: {check_inv.data[0]['suggested_time']}\n")
    
    # --- PHASE 2: The Bridge Offer ---
    print("--- Phase 2: The Bridge Offer ---")
    
    # Force another player to suggest the same time to create a "consensus"
    player_2 = invite_res.data[1]["players"]
    sugg_time_iso = (match_time + timedelta(hours=1)).isoformat()
    supabase.table("match_invites").update({"suggested_time": sugg_time_iso}).eq("invite_id", invite_res.data[1]["invite_id"]).execute()
    
    # Clear other invites so match feels "stuck"
    supabase.table("match_invites").update({"status": "declined"}).eq("match_id", match_id).eq("status", "sent").execute()
    
    # Run deadpool check (which should trigger bridge offer)
    print("Running process_batch_refills()...")
    # We need to ensure the match is considered stuck. 
    # Usually it happens if count < 3 in find_and_invite_players or via cron.
    # Let's call the deadpool check directly by simulating a matchmaking failure
    from matchmaker import _check_match_deadpool
    _check_match_deadpool(match_id)
    
    # Check if a message was "sent" to the organizer (it's dry_run, so we look at logs or mock it, but here we just check if state was updated)
    from redis_client import get_user_state
    org_state = get_user_state(from_number)
    print(f"Organizer State after deadpool check: {org_state.get('state')}")
    print(f"Bridge Time in State: {org_state.get('bridge_time_iso')}\n")
    
    # --- PHASE 3: Organizer Accepts Shift ---
    print("--- Phase 3: Organizer Accepts Shift ---")
    print("Organizer: 'Yes, shift it'")
    res = dispatcher.handle_sms(from_number, "Yes, shift it", dry_run=True, club_id=club_id)
    
    # Print the responses - one of them should be the "Re-inviting" message
    for r in res['responses']:
        print(f"System: {r['body']}")
        
    # Verify match time updated
    updated_match = supabase.table("matches").select("scheduled_time").eq("match_id", match_id).execute()
    new_time = parse_iso_datetime(updated_match.data[0]["scheduled_time"])
    print(f"New Match Time in DB: {new_time}\n")
    
    # --- PHASE 4: Last Call Flash ---
    print("--- Phase 4: Last Call Flash ---")
    
    # Create a match scheduled for 3 hours from now
    flash_match_time = (get_now_utc() + timedelta(hours=3)).isoformat()
    flash_match = supabase.table("matches").insert({
        "club_id": club_id,
        "originator_id": organizer["player_id"],
        "scheduled_time": flash_match_time,
        "status": "pending"
    }).execute()
    flash_match_id = flash_match.data[0]["match_id"]
    
    # Add 3 players total (including organizer)
    supabase.table("match_participations").insert([
        {"match_id": flash_match_id, "player_id": organizer["player_id"], "team_index": 1, "status": "confirmed"},
        {"match_id": flash_match_id, "player_id": players[0]["player_id"], "team_index": 1, "status": "confirmed"},
        {"match_id": flash_match_id, "player_id": players[1]["player_id"], "team_index": 2, "status": "confirmed"}
    ]).execute()
    
    print(f"Match created with 3/4 players for {flash_match_time}")
    print("Running process_last_call_flash()...")
    
    flashed_count = process_last_call_flash()
    print(f"Matches Flashed: {flashed_count}")
    
    # Verify match is marked as flashed
    check_match = supabase.table("matches").select("last_call_sent").eq("match_id", flash_match_id).execute()
    print(f"Match marked as flashed? {check_match.data[0]['last_call_sent']}")
    
    print("\n✅ Simulation Complete!")

if __name__ == "__main__":
    run_simulation()
