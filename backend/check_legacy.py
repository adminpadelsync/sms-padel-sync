from database import supabase
import json

try:
    res = supabase.table("matches").select("team_1_players").limit(1).execute()
    print("Legacy team_1_players EXISTS in production")
except Exception as e:
    print("Legacy team_1_players is GONE (Migration 099 likely applied)")
