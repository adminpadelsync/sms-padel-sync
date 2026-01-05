
import os
import psycopg2
from dotenv import load_dotenv

def apply_rpc():
    # Load from .env.local in root
    root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local')
    load_dotenv(root_env)
    
    # Also try backend/.env
    backend_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(backend_env)
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        # Fallback: construct from parts if available (common in Supabase envs)
        # postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
        print("DATABASE_URL not found. Checking for alternative vars...")
        return
        
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Read SQL file
        sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'plsql', 'rpc_invite_players.sql')
        with open(sql_path, 'r') as f:
            sql_content = f.read()
            
        print(f"Applying RPC from {sql_path}...")
        cursor.execute(sql_content)
        
        print("Success! RPC function created.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error applying RPC: {e}")

if __name__ == "__main__":
    apply_rpc()
