from database import supabase
import json

try:
    res = supabase.table("player_groups").select("visibility").limit(1).execute()
    print("visibility exists in player_groups")
except Exception as e:
    print(f"visibility check failed: {e}")
