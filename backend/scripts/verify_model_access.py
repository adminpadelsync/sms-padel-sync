
import os
import sys
import requests
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.abspath('backend'))

from llm_config import LLMConfig

def verify_models():
    api_key = LLMConfig.get_api_key()
    if not api_key:
        print("Error: Message GEMINI_API_KEY not found.")
        return

    print(f"Verifying models for API Key: {api_key[:10]}...")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            print(f"\nFound {len(models)} available models:")
            print("-" * 50)
            for m in models:
                if 'generateContent' in m.get('supportedGenerationMethods', []):
                    print(f"  - {m['name'].replace('models/', '')}")
            print("-" * 50)
            
            # Specific check for 2.5
            target = "gemini-2.5-flash"
            found = any(target in m['name'] for m in models)
            if found:
                print(f"\n[SUCCESS] {target} IS available!")
            else:
                print(f"\n[WARNING] {target} was NOT found in the list.")
                
        else:
            print(f"Error fetching models: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    verify_models()
