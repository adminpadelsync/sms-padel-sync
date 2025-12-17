"""Quick script to check matches in the database."""

from database import supabase

# Query all matches
print("\n=== ALL MATCHES ===")
result = supabase.table("matches").select("*").order("created_at", desc=True).limit(10).execute()

if not result.data:
    print("No matches found in database!")
else:
    for m in result.data:
        print(f"\nMatch ID: {m['match_id']}")
        print(f"  Status: {m['status']}")
        print(f"  Club ID: {m.get('club_id', 'N/A')}")
        print(f"  Scheduled: {m.get('scheduled_time', 'N/A')}")
        print(f"  Team 1: {m.get('team_1_players', [])}")
        print(f"  Team 2: {m.get('team_2_players', [])}")
        print(f"  Feedback Collected: {m.get('feedback_collected', False)}")

# Query all clubs
print("\n\n=== ALL CLUBS ===")
clubs_result = supabase.table("clubs").select("club_id, name, active").execute()
for c in clubs_result.data:
    print(f"  {c['club_id']}: {c['name']} (active={c.get('active', True)})")

# Query players count
print("\n\n=== PLAYERS ===")
players_result = supabase.table("players").select("player_id, name, club_id").limit(5).execute()
print(f"Found {len(players_result.data)} players (showing first 5)")
for p in players_result.data:
    print(f"  {p['name']} - Club: {p.get('club_id', 'N/A')}")
