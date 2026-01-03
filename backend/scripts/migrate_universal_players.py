
from database import supabase
import uuid


def migrate_to_universal_players():
    print("--- Starting Universal Player Migration ---")
    
    # 1. Fetch all players
    print("Fetching all players...")
    res = supabase.table("players").select("*").execute()
    all_players = res.data or []
    print(f"Found {len(all_players)} player records.")

    # 2. Group players by phone number
    phone_map = {}
    for p in all_players:
        phone = p['phone_number']
        if phone not in phone_map:
            phone_map[phone] = []
        phone_map[phone].append(p)

    print(f"Found {len(phone_map)} unique phone numbers.")

    # 3. For each phone number, select a "master" record and collect club associations
    to_delete = []
    memberships = []
    
    for phone, records in phone_map.items():
        # Sort by last_active or created_at to pick the most relevant record as master
        records.sort(key=lambda x: (x.get('last_active') or x.get('created_at') or ''), reverse=True)
        master = records[0]
        master_id = master['player_id']
        
        # All records for this phone number become members of their respective clubs
        processed_clubs = set()
        for r in records:
            club_id = r['club_id']
            if club_id not in processed_clubs:
                memberships.append({
                    "player_id": master_id,
                    "club_id": club_id
                })
                processed_clubs.add(club_id)
            
            if r['player_id'] != master_id:
                old_id = r['player_id']
                to_delete.append(old_id)
                print(f"Merging duplicate: {r['name']} ({old_id}) -> {master['name']} ({master_id})")
                migrate_player_references(old_id, master_id)

    print(f"Identified {len(to_delete)} duplicate records to merge.")
    print(f"Total memberships to create: {len(memberships)}")

    # B. Delete duplicates (References were already updated by migrate_player_references)
    if to_delete:
        print(f"Deleting {len(to_delete)} duplicate player records...")
        for pid in to_delete:
            supabase.table("players").delete().eq("player_id", pid).execute()

    print("--- Migration Complete ---")

def migrate_player_references(old_id, new_id):
    """Update all references to the old player_id to the new master player_id."""
    print(f"Migrating data for {old_id} -> {new_id}...")
    
    # 1. Matches (team_1_players, team_2_players, originator_id)
    # This is tricky because team_1_players is a JSON/Array column in Supabase
    # We'll fetch matches containing the old ID and update them manually
    
    # Matches as member of Team 1
    m1_res = supabase.table("matches").select("*").filter("team_1_players", "cs", f'{{"{old_id}"}}').execute()
    for m in (m1_res.data or []):
        new_team = [new_id if pid == old_id else pid for pid in m["team_1_players"]]
        supabase.table("matches").update({"team_1_players": new_team}).eq("match_id", m["match_id"]).execute()

    # Matches as member of Team 2
    m2_res = supabase.table("matches").select("*").filter("team_2_players", "cs", f'{{"{old_id}"}}').execute()
    for m in (m2_res.data or []):
        new_team = [new_id if pid == old_id else pid for pid in m["team_2_players"]]
        supabase.table("matches").update({"team_2_players": new_team}).eq("match_id", m["match_id"]).execute()
    
    # Matches as originator
    supabase.table("matches").update({"originator_id": new_id}).eq("originator_id", old_id).execute()

    # 1.5 Club Memberships
    # This table was already populated by SQL Stage 2 with old_ids.
    # We must migrate them to new_id.
    cm_res = supabase.table("club_members").select("*").eq("player_id", old_id).execute()
    for cm in (cm_res.data or []):
        club_id = cm["club_id"]
        # Check if new_id is already a member of this club
        exists = supabase.table("club_members").select("*").eq("club_id", club_id).eq("player_id", new_id).execute()
        if exists.data:
            # Delete the old membership
            supabase.table("club_members").delete().eq("club_id", club_id).eq("player_id", old_id).execute()
        else:
            # Update the old membership to the new_id
            supabase.table("club_members").update({"player_id": new_id}).eq("club_id", club_id).eq("player_id", old_id).execute()

    # 2. Match Invites
    supabase.table("match_invites").update({"player_id": new_id}).eq("player_id", old_id).execute()

    # 3. Match Feedback
    supabase.table("match_feedback").update({"player_id": new_id}).eq("player_id", old_id).execute()
    
    # 4. Feedback Requests
    supabase.table("feedback_requests").update({"player_id": new_id}).eq("player_id", old_id).execute()

    # 5. Group Memberships
    # Handle potential duplicates if both old and new ID are in the same group
    gm_res = supabase.table("group_memberships").select("*").eq("player_id", old_id).execute()
    for gm in (gm_res.data or []):
        group_id = gm["group_id"]
        # Check if new_id is already in this group
        exists = supabase.table("group_memberships").select("*").eq("group_id", group_id).eq("player_id", new_id).execute()
        if exists.data:
            # Delete the old one
            supabase.table("group_memberships").delete().eq("group_id", group_id).eq("player_id", old_id).execute()
        else:
            # Update the old one
            supabase.table("group_memberships").update({"player_id": new_id}).eq("group_id", group_id).eq("player_id", old_id).execute()

    # 6. Rating History
    supabase.table("player_rating_history").update({"player_id": new_id}).eq("player_id", old_id).execute()

    # 7. Compatibility (player_1_id, player_2_id)
    # This requires merging counts if both exist
    c1_res = supabase.table("player_compatibility").select("*").eq("player_1_id", old_id).execute()
    for c in (c1_res.data or []):
        other_id = c["player_2_id"]
        # New pair IDs (sorted)
        p1, p2 = (new_id, other_id) if new_id < other_id else (other_id, new_id)
        
        # Check if record already exists for new_id + other_id
        exists = supabase.table("player_compatibility").select("*").eq("player_1_id", p1).eq("player_2_id", p2).execute()
        if exists.data:
            old_c = exists.data[0]
            new_yes = old_c["would_play_again_count"] + c["would_play_again_count"]
            new_no = old_c["would_not_play_again_count"] + c["would_not_play_again_count"]
            total = new_yes + new_no
            new_score = int((new_yes / total) * 100) if total > 0 else 50
            
            supabase.table("player_compatibility").update({
                "would_play_again_count": new_yes,
                "would_not_play_again_count": new_no,
                "compatibility_score": new_score
            }).eq("player_1_id", p1).eq("player_2_id", p2).execute()
            
            # Delete old record
            supabase.table("player_compatibility").delete().eq("player_1_id", old_id).eq("player_2_id", other_id).execute()
        else:
            # Update to new ID
            supabase.table("player_compatibility").update({"player_1_id": p1, "player_2_id": p2}).eq("player_1_id", old_id).eq("player_2_id", other_id).execute()

    c2_res = supabase.table("player_compatibility").select("*").eq("player_2_id", old_id).execute()
    for c in (c2_res.data or []):
        other_id = c["player_1_id"]
        # New pair IDs (sorted)
        p1, p2 = (new_id, other_id) if new_id < other_id else (other_id, new_id)
        
        # Check if record already exists for new_id + other_id
        exists = supabase.table("player_compatibility").select("*").eq("player_1_id", p1).eq("player_2_id", p2).execute()
        if exists.data:
            old_c = exists.data[0]
            new_yes = old_c["would_play_again_count"] + c["would_play_again_count"]
            new_no = old_c["would_not_play_again_count"] + c["would_not_play_again_count"]
            total = new_yes + new_no
            new_score = int((new_yes / total) * 100) if total > 0 else 50
            
            supabase.table("player_compatibility").update({
                "would_play_again_count": new_yes,
                "would_not_play_again_count": new_no,
                "compatibility_score": new_score
            }).eq("player_1_id", p1).eq("player_2_id", p2).execute()
            
            # Delete old record
            supabase.table("player_compatibility").delete().eq("player_1_id", other_id).eq("player_2_id", old_id).execute()
        else:
            # Update to new ID
            supabase.table("player_compatibility").update({"player_1_id": p1, "player_2_id": p2}).eq("player_1_id", other_id).eq("player_2_id", old_id).execute()

if __name__ == "__main__":
    migrate_to_universal_players()
