import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

def get_db_schema(url, key, name):
    print(f"--- Fetching schema for {name} ---")
    client = create_client(url, key)
    
    # Query information_schema for tables and columns
    # We use rpc or raw sql if possible, but since we are using the client,
    # we might need to use a trick or just query the public tables we know.
    # Actually, the best way is to query information_schema.columns
    
    try:
        # We'll use the 'query' method which is available on the postgrest client
        # but the supabase-py client doesn't expose raw sql execution easily 
        # unless we use a function.
        # Alternatively, we can try to fetch a small amount of data from each table 
        # to see if it exists, but that doesn't check columns.
        
        # Let's try to query the REST API's OpenAPI spec which Supabase provides
        import requests
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        response = requests.get(f"{url}/rest/v1/?apikey={key}", headers=headers)
        if response.status_code != 200:
             print(f"Error fetching schema for {name}: {response.status_code}")
             return None
        
        return response.json().get('definitions', {})
    except Exception as e:
        print(f"Error connecting to {name}: {e}")
        return None

def compare_schemas():
    prod_url = os.environ.get("SUPABASE_URL")
    prod_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    test_url = os.environ.get("SUPABASE_URL_TEST")
    test_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_TEST")
    
    if not all([prod_url, prod_key, test_url, test_key]):
        print("Missing environment variables. Ensure both PROD and TEST keys are in .env")
        return

    prod_schema = get_db_schema(prod_url, prod_key, "PRODUCTION")
    test_schema = get_db_schema(test_url, test_key, "TEST")
    
    if not prod_schema or not test_schema:
        return

    print("\n" + "="*50)
    print("      SCHEMA COMPARISON RESULT")
    print("="*50)

    prod_tables = set(prod_schema.keys())
    test_tables = set(test_schema.keys())

    # 1. Missing Tables
    missing_in_test = prod_tables - test_tables
    missing_in_prod = test_tables - prod_tables

    if missing_in_test:
        print(f"\n❌ Tables in Prod but MISSING in Test: {', '.join(missing_in_test)}")
    if missing_in_prod:
        print(f"\n⚠️  Tables in Test but NOT in Prod: {', '.join(missing_in_prod)}")

    # 2. Column Comparison
    common_tables = prod_tables & test_tables
    issues_found = False
    
    for table in sorted(common_tables):
        prod_cols = set(prod_schema[table].get('properties', {}).keys())
        test_cols = set(test_schema[table].get('properties', {}).keys())
        
        diff_prod = prod_cols - test_cols
        diff_test = test_cols - prod_cols
        
        if diff_prod or diff_test:
            issues_found = True
            print(f"\nMismatch in table: {table}")
            if diff_prod:
                 print(f"  - Missing in Test: {', '.join(diff_prod)}")
            if diff_test:
                 print(f"  - Extra in Test: {', '.join(diff_test)}")

    if not issues_found and not missing_in_test:
        print("\n✅ SUCCESS: All tables and columns match between Production and Test!")
    else:
        print("\n❌ RESOLUTION REQUIRED: Sync your test schema using consolidated_test_schema.sql")

if __name__ == "__main__":
    compare_schemas()
