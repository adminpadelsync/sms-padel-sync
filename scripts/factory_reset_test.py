import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from twilio.rest import Client as TwilioClient

# Path setup
base_dir = Path(__file__).parent.parent
backend_dir = base_dir / "backend"
load_dotenv(backend_dir / ".env")

def factory_reset_test():
    db_url = os.getenv("DATABASE_URL_TEST")
    sb_url = os.getenv("SUPABASE_URL_TEST")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY_TEST")
    t_sid = os.getenv("TWILIO_ACCOUNT_SID")
    t_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if not all([db_url, sb_url, sb_key]):
        print("Error: Required TEST environment variables not found in backend/.env")
        return

    sb: Client = create_client(sb_url, sb_key)

    # 0. Cleanup Twilio Numbers (BEFORE DB reset)
    if t_sid and t_token:
        print("📞 CLEANING UP TWILIO NUMBERS...")
        try:
            twilio = TwilioClient(t_sid, t_token)
            
            # Release Club Numbers
            clubs_res = sb.table("clubs").select("club_id, name, twilio_sid").execute()
            for club in (clubs_res.data or []):
                sid = club.get("twilio_sid")
                if sid:
                    try:
                        twilio.incoming_phone_numbers(sid).delete()
                        print(f"✅ Released number for club: {club['name']}")
                    except Exception as te:
                        print(f"⚠️ Failed to release number for {club['name']} (might already be gone): {te}")

            # Release Group Numbers
            groups_res = sb.table("player_groups").select("group_id, name, twilio_sid").execute()
            for group in (groups_res.data or []):
                sid = group.get("twilio_sid")
                if sid:
                    try:
                        twilio.incoming_phone_numbers(sid).delete()
                        print(f"✅ Released number for group: {group['name']}")
                    except Exception as te:
                        print(f"⚠️ Failed to release number for group {group['name']}: {te}")
        except Exception as e:
            print(f"⚠️ Twilio cleanup failed (continuing anyway): {e}")
    else:
        print("ℹ️ Skipping Twilio cleanup: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing.")

    # 1. Reset Database Schema
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if "?" in db_url:
        db_url = db_url.split("?")[0]

    schema_path = base_dir / "consolidated_test_schema.sql"
    
    print(f"🔥 RESETTING TEST DATABASE: {sb_url}")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            with open(schema_path, "r") as f:
                cur.execute(f.read())
        conn.close()
        print("✅ Schema reset complete.")
    except Exception as e:
        print(f"❌ Schema reset failed: {e}")
        return

    # 2. Re-provision Admin User
    print("👤 Provisioning admin user: adam@the-rogers.com...")
    
    email = "adam@the-rogers.com"
    password = "123456"
    
    try:
        user_id = None
        users = sb.auth.admin.list_users()
        for u in users:
            if u.email == email:
                user_id = u.id
                break
        
        if not user_id:
            res = sb.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True
            })
            user_id = res.user.id
            print(f"Created new Auth user: {user_id}")
        else:
            print(f"Found existing Auth user ID: {user_id}")

        # Final Sync
        sb.table("users").upsert({
            "user_id": user_id,
            "email": email,
            "is_superuser": True,
            "role": "club_admin",
            "active": True
        }).execute()
        print(f"✅ User synced to public.users.")
        print("\n✨ FACTORY RESET COMPLETE! You now have a clean Test environment.")

    except Exception as e:
        print(f"❌ User provisioning failed: {e}")

if __name__ == "__main__":
    factory_reset_test()
