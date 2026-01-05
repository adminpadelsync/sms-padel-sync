
import os
import sys
from dotenv import load_dotenv
from collections import defaultdict

# Only add path if running as main script, not when imported
if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import supabase
from scoring_engine import calculate_responsiveness_score, calculate_reputation_score

def recalculate_player_scores(player_id=None):
    """
    Recalculate scores for a single player or all players using Supabase client.
    Updates 'responsiveness_score' and 'reputation_score' in the players table.
    """
    if not supabase:
        raise Exception("Supabase client not initialized. Check environment variables.")

    try:
        # 1. Fetch Players
        query = supabase.table("players").select("player_id, name, total_no_shows, total_matches_played")
        if player_id:
            query = query.eq("player_id", player_id)
        
        # Paginate if needed, but for now assuming < 1000 players fit in one response (default limit is usually 1000)
        players_res = query.execute()
        players = players_res.data or []
        
        # 2. Fetch Invites (All or filtered)
        # To avoid N+1, if processing all players, fetch ALL invites.
        inv_query = supabase.table("match_invites").select("player_id, status")
        if player_id:
            inv_query = inv_query.eq("player_id", player_id)
            
        # Supabase default limit is 1000. Use range only if needed.
        # For safety let's fetch a large chunk or handle pagination if expecting > 1000 invites.
        # But 'select' usually returns 1000.
        # Let's try fetching up to 500 invites (reduced to avoid Vercel timeout).
        inv_res = inv_query.limit(500).execute()
        invites = inv_res.data or []
        
        # 2b. Fetch Matches to calculate total_matches_played
        # Phase 4: Use match_participations
        # First get relevant match IDs (confirmed/completed)
        match_query = supabase.table("matches").select("match_id").in_("status", ["confirmed", "completed"])
        match_res = match_query.limit(500).execute()
        match_ids = [m["match_id"] for m in (match_res.data or [])]
        
        # 3. Aggregate Stats
        # Structure: player_id -> {'total': 0, 'responded': 0, 'accepted': 0}
        stats_map = defaultdict(lambda: {'total': 0, 'responded': 0, 'accepted': 0})
        
        for inv in invites:
            pid = inv['player_id']
            status = inv.get('status')
            
            stats_map[pid]['total'] += 1
            if status in ['accepted', 'declined']:
                stats_map[pid]['responded'] += 1
            if status == 'accepted':
                stats_map[pid]['accepted'] += 1
                
        # 3b. Aggregate Match Counts via match_participations
        match_counts = defaultdict(int)
        if match_ids:
            # Fetch participations for these matches
            # Can limit if needed, but for 500 matches * 4 players = 2000 rows, should be fine
            parts_res = supabase.table("match_participations").select("player_id").in_("match_id", match_ids).execute()
            for row in (parts_res.data or []):
                match_counts[row["player_id"]] += 1
                
        # 4. Calculate and Update
        updated_count = 0
        
        for player in players:
            p_id = player['player_id']
            stats = stats_map[p_id]
            
            # Enrich player dict for scoring engine
            player['total_invites_received'] = stats['total']
            player['responded_count'] = stats['responded']
            # player['total_no_shows'] is already there
            
            # Calculate Scors
            resp_score = calculate_responsiveness_score(player)
            rep_score = calculate_reputation_score(player)
            
            # Update DB
            update_data = {
                "responsiveness_score": resp_score,
                "reputation_score": rep_score,
                "total_invites_received": stats['total'],
                "total_invites_accepted": stats['accepted'],
                "total_matches_played": match_counts[p_id]
            }
            
            supabase.table("players").update(update_data).eq("player_id", p_id).execute()
            updated_count += 1
            
        print(f"Successfully updated scores for {updated_count} players.")
        return updated_count
        
    except Exception as e:
        print(f"Error updating scores: {e}")
        # Re-raise so API knows it failed
        raise e

if __name__ == "__main__":
    load_dotenv()
    print("Starting score recalculation...")
    recalculate_player_scores()
    print("Done.")
