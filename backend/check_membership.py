from database import supabase

def check():
    # 1. Find club
    club_res = supabase.table("clubs").select("*").eq("phone_number", "+15619562492").execute()
    if not club_res.data:
        print("Club not found")
        return
    club = club_res.data[0]
    club_id = club["club_id"]
    print(f"Club: {club['name']} ({club_id})")

    # 2. Find player by name "Aaron" or common phone format
    # In the screenshot Aaron's phone is not visible, but he says he's already in the system.
    # I'll search for players named Aaron.
    players = supabase.table("players").select("*").ilike("name", "%Aaron%").execute().data
    for p in players:
        print(f"Player: {p['name']} ({p['player_id']}) | Phone: {p['phone_number']}")
        # Check club memberships
        members = supabase.table("club_members").select("*").eq("player_id", p["player_id"]).eq("club_id", club_id).execute().data
        print(f"  Is member of THIS club: {bool(members)}")
        
        # Check all memberships
        all_members = supabase.table("club_members").select("club_id, clubs(name)").eq("player_id", p["player_id"]).execute().data
        print(f"  All club memberships: {[m['clubs']['name'] for m in all_members if m.get('clubs')]}")

if __name__ == "__main__":
    check()
