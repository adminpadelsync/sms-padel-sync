
import os
import sys
from dotenv import load_dotenv

# Add backend directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db_connection
from scoring_engine import calculate_responsiveness_score, calculate_reputation_score

def recalculate_player_scores(player_id=None):
    """
    Recalculate scores for a single player or all players if player_id is None.
    Updates 'responsiveness_score' and 'reputation_score' in the players table.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Fetch players
        query = "SELECT player_id, name, total_no_shows, total_matches_played FROM players"
        params = []
        if player_id:
            query += " WHERE player_id = %s"
            params.append(player_id)
            
        cursor.execute(query, tuple(params))
        players = cursor.fetchall() # returns list of tuples or dicts if RealDictCursor
        
        # We need dictionary access. If psycopg2 defaults to tuples, we need to map.
        # Assuming get_db_connection returns RealDictCursor or we handle it.
        # Let's assume standard cursor for now and map assuming order.
        desc = cursor.description
        column_names = [col[0] for col in desc]
        
        updated_count = 0
        
        for row in players:
            player = dict(zip(column_names, row))
            p_id = player['player_id']
            
            # 1. Fetch Invite Stats for Responsiveness
            # Count accepted/declined vs total
            # status: 'accepted', 'declined' = responded
            # status: 'sent', 'expired' = ignored (if expired)
            
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status IN ('accepted', 'declined')) as responded,
                    COUNT(*) FILTER (WHERE status = 'accepted') as accepted
                FROM match_invites 
                WHERE player_id = %s
            """, (p_id,))
            
            stats = cursor.fetchone()
            # map stats
            stats_dict = dict(zip([col[0] for col in cursor.description], stats))
            
            player['total_invites_received'] = stats_dict['total']
            player['responded_count'] = stats_dict['responded']
            # We can also update the cached counters while we are at it
            total_accepted = stats_dict['accepted']
            
            # Calculate Scores
            resp_score = calculate_responsiveness_score(player)
            rep_score = calculate_reputation_score(player)
            
            # Update DB
            cursor.execute("""
                UPDATE players 
                SET 
                    responsiveness_score = %s,
                    reputation_score = %s,
                    total_invites_received = %s,
                    total_invites_accepted = %s
                WHERE player_id = %s
            """, (resp_score, rep_score, stats_dict['total'], total_accepted, p_id))
            
            updated_count += 1
            
        conn.commit()
        print(f"Successfully updated scores for {updated_count} players.")
        
    except Exception as e:
        conn.rollback()
        print(f"Error updating scores: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    load_dotenv()
    print("Starting score recalculation...")
    recalculate_player_scores()
    print("Done.")
