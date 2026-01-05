import os
import psycopg2
from pathlib import Path

# Load .env
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key] = val.strip('"\'')

DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("No DATABASE_URL found in backend/.env")
    exit(1)

SQL_FILE = Path(__file__).parent.parent / "migrations/029_fix_player_deletion_constraints.sql"
print(f"Applying migration from {SQL_FILE}")

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    with open(SQL_FILE) as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()
    print("Successfully applied migration 029.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    exit(1)
