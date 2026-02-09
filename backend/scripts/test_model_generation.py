
import os
import sys
import requests
import json
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath('backend'))

from llm_config import LLMConfig

def test_generation(model_name="gemini-flash-latest"):
    api_key = LLMConfig.get_api_key()
    if not api_key:
        print("Error: Gemini API Key not found.")
        return

    print(f"Testing generation with model: {model_name}")
    print(f"Using API Key: {api_key[:10]}...")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{"text": "Hello, are you working?"}]
        }]
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("Success! Response:")
            print(json.dumps(response.json(), indent=2))
        else:
            print("Error Response:")
            print(response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_generation(sys.argv[1])
    else:
        test_generation("gemini-2.5-flash")
