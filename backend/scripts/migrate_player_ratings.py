from database import supabase
from logic.elo_service import update_match_elo, get_initial_elo

# Target Players
PLAYERS = {
    '4b639432-1e1f-4aa9-b2a5-093af8da6981': 'Adam Rogers',
    '56f78e2b-9240-42de-8d9b-ea66528891bf': 'Billy Marino',
    '22a99456-4d11-4780-8874-fefb725df17e': 'Eddie Ventrice',
    '87771b1a-5276-42cb-9d5e-8b009e689d7a': 'Jeff Miller'
}

# Matches in Order
MATCH_IDS = [
    '2045e496-f10b-4f01-87c2-9e9279333975',
    '5cbe80d3-2568-4fa5-aa72-d18e89154e98'
]

def migrate():
    print("🚀 Starting Rating Migration...")
    
    # 1. Delete old history for these matches/players
    print("🧹 Cleaning up old history...")
    supabase.table('player_rating_history').delete().in_('player_id', list(PLAYERS.keys())).in_('match_id', MATCH_IDS).execute()
    
    # 2. Reset players to correct seeding
    for pid, name in PLAYERS.items():
        # Fetch current declared level
        p_res = supabase.table('players').select('declared_skill_level').eq('player_id', pid).execute()
        if not p_res.data:
            print(f"❌ Could not find player {name} ({pid})")
            continue
            
        declared_level = float(p_res.data[0]['declared_skill_level'])
        initial_elo = get_initial_elo(declared_level)
        initial_sync = round((initial_elo - 500) / 400, 2)
        
        print(f"🔄 Resetting {name} to {declared_level} -> {initial_elo} Elo ({initial_sync} Sync)")
        
        supabase.table('players').update({
            'elo_rating': initial_elo,
            'elo_confidence': 0,
            'adjusted_skill_level': initial_sync
        }).eq('player_id', pid).execute()

    # 3. Re-apply match results
    for mid in MATCH_IDS:
        print(f"🎾 Re-processing match {mid}...")
        # Get match winner
        m_res = supabase.table('matches').select('winner_team').eq('match_id', mid).execute()
        if not m_res.data or m_res.data[0]['winner_team'] is None:
            print(f"⚠️ Skipping match {mid} - no winner recorded.")
            continue
            
        winner_team = m_res.data[0]['winner_team']
        success = update_match_elo(mid, winner_team)
        if success:
            print(f"✅ Match {mid} processed.")
        else:
            print(f"❌ Match {mid} failed.")

    print("✨ Migration Complete!")

if __name__ == "__main__":
    migrate()
