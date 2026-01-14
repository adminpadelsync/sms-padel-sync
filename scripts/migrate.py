#!/usr/bin/env python3
import os
import argparse
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
backend_dir = Path(__file__).parent.parent / "backend"
load_dotenv(backend_dir / ".env")

def get_connection(env="dev"):
    # Target switching is now handled by shell environment (verify.sh) or Vercel native scoping
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        raise ValueError("DATABASE_URL must be set in the environment.")
    
    # psycopg2 often prefers postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    # Strip query parameters like ?pgbouncer=true as psycopg2 might reject them in some DSN formats
    if "?" in db_url:
        db_url = db_url.split("?")[0]
        
    return psycopg2.connect(db_url)

def setup_migrations_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            filename TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

def run_migrations(env="dev", dry_run=False, checkpoint=False):
    print(f"🚀 Running migrations for environment: {env} {'(DRY RUN)' if dry_run else ''} {'(CHECKPOINT)' if checkpoint else ''}")
    
    migrations_dir = backend_dir / "migrations"
    sql_files = sorted([f for f in migrations_dir.glob("*.sql") if f.is_file()])
    
    conn = get_connection(env)
    try:
        cur = conn.cursor()
        setup_migrations_table(cur)
        
        # Get applied migrations
        cur.execute("SELECT filename FROM _migrations;")
        applied = {row[0] for row in cur.fetchall()}
        
        for sql_file in sql_files:
            if sql_file.name in applied:
                print(f"✅ {sql_file.name} (already applied)")
                continue
            
            print(f"📦 Applying {sql_file.name}...")
            with open(sql_file, "r") as f:
                sql = f.read()
            
            if not dry_run:
                try:
                    if not checkpoint:
                        cur.execute(sql)
                        print(f"✨ Successfully applied {sql_file.name}")
                    else:
                        print(f"🏁 Checkpointing {sql_file.name} (marking as applied)")
                    
                    cur.execute("INSERT INTO _migrations (filename) VALUES (%s)", (sql_file.name,))
                except Exception as e:
                    print(f"❌ Error applying/checkpointing {sql_file.name}: {e}")
                    conn.rollback()
                    return
            else:
                print(f"🔍 Dry run: would {'checkpoint' if checkpoint else 'apply'} {sql_file.name}")
        
        if not dry_run:
            conn.commit()
            print("🎉 All migrations complete!")
        else:
            print("📋 Dry run complete. No changes made.")
            
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified Migration Runner")
    parser.add_argument("--env", choices=["dev", "test", "prod"], default="dev", help="Environment to target")
    parser.add_argument("--dry-run", action="store_true", help="Show pending migrations without applying them")
    parser.add_argument("--checkpoint", action="store_true", help="Mark all migrations as applied without running them")
    
    args = parser.parse_args()
    try:
        run_migrations(args.env, args.dry_run, args.checkpoint)
    except Exception as e:
        print(f"🚨 Migration failed: {e}")
        exit(1)
