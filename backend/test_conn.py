import os
import httpx
from supabase import create_client, Client

url = "https://mqsphpkotueoyngdsxwt.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3BocGtvdHVlb3luZ2RzeHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4MzgxNCwiZXhwIjoyMDc5MTU5ODE0fQ.MAFhhh7yW36J2suIl514T4ySHYiaZ0QVNbbkbGeVc3g"

try:
    supabase = create_client(url, key)
    res = supabase.table("clubs").select("*").execute()
    print("Success!")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
