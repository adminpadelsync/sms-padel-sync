from database import supabase

def check():
    if not supabase:
        print("Supabase client not initialized")
        return

    print("Checking clubs...")
    try:
        res = supabase.table("clubs").select("*").execute()
        print(f"Total clubs found: {len(res.data)}")
        for club in res.data:
            print(f"- {club['name']} (ID: {club['club_id']}, Active: {club.get('active')})")
    except Exception as e:
        print(f"Error fetching clubs: {e}")

if __name__ == "__main__":
    check()
