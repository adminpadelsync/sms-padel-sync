import requests
import os
import json
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.abspath('backend'))

def test_api(key, model, label):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": "Hello, are you there?"}]
        }]
    }
    
    print(f"--- Testing {label} [{model}] ---")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Error Body: {response.text}")
        else:
            print("Success!")
    except Exception as e:
        print(f"Exception: {e}")
    print("\n")

if __name__ == "__main__":
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set in environment.")
        sys.exit(1)
    
    model = os.getenv("LLM_MODEL_NAME", "gemini-2.5-flash")

    print(f"Testing API Key: {api_key[:10]}...")
    print(f"Testing Model: {model}")
    test_api(api_key, model, "ENV_KEY")

