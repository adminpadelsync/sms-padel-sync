import os
from database import url, key

print(f"URL: '{url}'")
print(f"URL Length: {len(url)}")
print(f"Key preview: '{key[:10]}...{key[-10:]}'")

from database import supabase
import json

try:
    res = supabase.table("match_invites").select("invite_id").limit(1).execute()
    print("Connection success!")
except Exception as e:
    print(f"Error: {e}")
