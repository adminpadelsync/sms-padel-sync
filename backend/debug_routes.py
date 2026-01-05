from main import app
import os

print(f"VERCEL env: {os.environ.get('VERCEL')}")
prefix = '' if os.environ.get('VERCEL') else '/api'
print(f"Computed prefix: {prefix}")

print("\n--- Registered Routes ---")
for route in app.routes:
    methods = getattr(route, "methods", "N/A")
    print(f"{methods} {route.path}")
