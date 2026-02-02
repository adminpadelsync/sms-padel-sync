import os
import re
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL_PROD")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_PROD")
supabase = create_client(url, key)

def normalize_phone(phone: str) -> str:
    if not phone:
        return None
    # Strip everything except digits
    digits = re.sub(r'\D', '', phone)
    
    # If it's 10 digits, assume US and add +1
    if len(digits) == 10:
        return f"+1{digits}"
    # If it starts with 1 and is 11 digits, just add +
    elif len(digits) == 11 and digits.startswith('1'):
        return f"+{digits}"
    # If it already has + and digits, return as is (but cleaned of formatting)
    elif phone.startswith('+'):
        return f"+{digits}"
    
    # Fallback: Just return with + if digits exist
    return f"+{digits}" if digits else None

def sanitize_table(table_name: str, id_col: str):
    print(f"--- Sanitizing {table_name} ---")
    res = supabase.table(table_name).select(f"{id_col}, phone_number").execute()
    count = 0
    for row in res.data:
        original = row.get("phone_number")
        if not original:
            continue
            
        normalized = normalize_phone(original)
        if normalized != original:
            print(f"Updating {original} -> {normalized}")
            supabase.table(table_name).update({"phone_number": normalized}).eq(id_col, row[id_col]).execute()
            count += 1
    print(f"Finished {table_name}. Updated {count} records.")

if __name__ == "__main__":
    sanitize_table("players", "player_id")
    sanitize_table("clubs", "club_id")
    sanitize_table("player_groups", "group_id")
    print("ALL TABLES SANITIZED.")
