from database import supabase

def check_table():
    try:
        # Check if table exists and we can select from it
        result = supabase.table("assessment_results").select("*").limit(1).execute()
        print("Table 'assessment_results' exists and is reachable.")
        print(f"Current rows: {len(result.data)}")
        
        # Try a test insert
        test_data = {
            "player_name": "RLS Check",
            "responses": {},
            "rating": 1.0,
            "breakdown": {}
        }
        insert_res = supabase.table("assessment_results").insert(test_data).execute()
        if insert_res.data:
            print("Test insert successful!")
            # Cleanup
            supabase.table("assessment_results").delete().eq("player_name", "RLS Check").execute()
        else:
            print("Test insert failed (no data returned). This might be due to RLS.")
            
    except Exception as e:
        print(f"Error checking table: {e}")

if __name__ == "__main__":
    check_table()
