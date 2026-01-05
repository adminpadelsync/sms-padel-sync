from database import supabase
import json

def fetch_samples():
    print("--- Golden Samples (reasoner_test_cases) ---")
    res = supabase.table("reasoner_test_cases").select("*").execute()
    if res.data:
        for row in res.data:
            print(f"\nCase: {row['name']}")
            print(f"Steps: {json.dumps(row['steps'], indent=2)}")
    else:
        print("No golden samples found.")

if __name__ == "__main__":
    fetch_samples()
