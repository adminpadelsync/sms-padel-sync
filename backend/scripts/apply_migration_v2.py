import os
import psycopg2
from pathlib import Path

# Try to load .env manually since I can't be sure of dotenv
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    print(f"Loading env from {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ[key] = val.strip('"\'')

DB_URL = os.getenv("DATABASE_URL")
# Helper: if it's a Supabase transaction pooler, it usually looks like postgres://...
# psycopg2 prefers postgresql:// but implies it.

if not DB_URL:
    print("No DATABASE_URL found in backend/.env")
    exit(1)

SQL_FILE = Path(__file__).parent.parent / "migrations/001_create_match_participations.sql"
print(f"Applying migration from {SQL_FILE}")

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    with open(SQL_FILE) as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()
    print("Successfully applied migration.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    exit(1)
