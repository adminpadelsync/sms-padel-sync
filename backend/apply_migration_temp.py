from database import supabase
import sys

sql = """
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES private_groups(group_id);
"""

try:
    print("Applying migration...")
    # Using rpc if available or raw sql if client supports it? 
    # Supabase-py doesn't support raw SQL execution easily without a function.
    # But we can try to use the 'rpc' call if we had a dedicated function, which we might not.
    # Actually, let's use the postgres connection directly if possible, or just print instructions?
    # Wait, previous migrations might have been manual. 
    # Let's try to see if there's a psycopg2 or asyncpg connection we can use? 
    # No, typically we rely on the client.
    # Let's check database.py to see how it connects.
    pass
except Exception as e:
    print(e)
