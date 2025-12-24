import os
import json
import requests
import time
import random
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

# Gemini REST API Configuration
GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

class ReasonerResult:
    def __init__(self, intent: str, confidence: float, entities: Dict[str, Any], raw_reply: Optional[str] = None):
        self.intent = intent
        self.confidence = confidence
        self.entities = entities
        self.raw_reply = raw_reply

    def __repr__(self):
        return f"ReasonerResult(intent={self.intent}, confidence={self.confidence}, entities={self.entities})"

PROMPT_TEMPLATE = """
You are the reasoning engine for an SMS-based Padel Matchmaking application.
Your goal is to extract the user's intent and any relevant entities from their message.

Current User State: {current_state}
Current User Profile: {user_profile}

### Intents:
- START_MATCH: Requesting to play a match (Look for "play", "match", "game").
- JOIN_GROUP: Wanting to join a specific group (Look for "groups", number selections LIKE "1", "2").
- SET_AVAILABILITY: Providing availability (Look for "mornings", "weekends", "anytime").
- CHECK_STATUS: Asking for match invites or next matches (Look for "matches", "next", "status").
- MUTE: Wanting to pause invites (Look for "mute", "pause", "stop").
- UNMUTE: Resuming invites (Look for "unmute", "resume", "start").
- SUBMIT_FEEDBACK: Providing numeric ratings for players (Look for sequence of numbers e.g. "1 9 8" or "10 10 10").
- REPORT_RESULT: Reporting the outcome of a match including teams and score (Look for "won", "lost", "score was", "beat").
- RESET: Wanting to start over or clear state.
- GREETING: Just saying hello.
- CHITCHAT: General banter or feedback.
- UNKNOWN: None of the above.

### Entities to extract:
- date: e.g., "Sunday", "Tomorrow", "Dec 20".
- time: e.g., "4pm", "18:00", "afternoon".
- selection: e.g., "1", "first one" (for groups).
- ratings: e.g., [1, 9, 8] (list of integers).
- skill_level: e.g., "3.5", "intermediate", "C".
- gender: e.g., "male", "female".
- score: e.g., "6-4 6-2", "tiebreak 10-8".
- winner: e.g., "Team 1", "Me", "Opponents", or participant names.
- team_a: e.g., ["Me", "Dave"] (names of players on first team).
- team_b: e.g., ["Sarah", "Mike"] (names of players on second team).

### Examples:
User: "1 9 8"
Result: {{ "intent": "SUBMIT_FEEDBACK", "confidence": 0.9, "entities": {{ "ratings": [1, 9, 8] }} }}

User: "play today at 4pm"
Result: {{ "intent": "START_MATCH", "confidence": 1.0, "entities": {{ "date": "today", "time": "4pm" }} }}

User: "actually i want to join group 2"
Result: {{ "intent": "JOIN_GROUP", "confidence": 0.9, "entities": {{ "selection": 2 }} }}

User: "play around 4pm today"
Result: {{ "intent": "START_MATCH", "confidence": 1.0, "entities": {{ "date": "today", "time": "4pm" }} }}

User: "play at 6:30 tomorrow"
Result: {{ "intent": "START_MATCH", "confidence": 1.0, "entities": {{ "date": "tomorrow", "time": "6:30" }} }}

User: "Me and Dave beat Sarah and Mike 6-4 6-4"
Result: {{ "intent": "REPORT_RESULT", "confidence": 1.0, "entities": {{ "score": "6-4 6-4", "team_a": ["Me", "Dave"], "team_b": ["Sarah", "Mike"], "winner": "team_a" }} }}

User: "We lost 7-5 6-2"
Result: {{ "intent": "REPORT_RESULT", "confidence": 0.9, "entities": {{ "score": "7-5 6-2", "winner": "team_b" }} }}

### Explicit Instructions:
- If use says "play", "match", "game", "reset", "matches", "groups", "mute", or "unmute", this is a HIGH CONFIDENCE intent that should interrupt any current flow.
- "1 9 8" or similar numeric sequences are ONLY for feedback.

### Output Format:
Return ONLY a JSON object:
{{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "entities": {{ ... }},
  "reasoning": "Brief explanation of why"
}}

User Message: "{message}"
"""

def call_gemini_api(prompt: str, api_key: str, model_name: str = "gemini-2.0-flash") -> Optional[str]:
    """Helper to call Gemini via REST API to avoid SDK dependency issues."""
    url = GEMINI_API_URL_TEMPLATE.format(model=model_name, key=api_key)
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1024
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        
        # Parse response path: candidates[0].content.parts[0].text
        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                parts = candidate["content"]["parts"]
                if len(parts) > 0 and "text" in parts[0]:
                    return parts[0]["text"]
        
        print(f"[REASONER] Unexpected API response structure: {result}")
        return None
        
    except Exception as e:
        print(f"[REASONER] API Request Failed: {e}")
        # If response exists, print it for debugging
        if 'response' in locals():
            try:
                print(f"[REASONER] Error Response: {response.text}")
            except:
                pass
        return None

def reason_message(message: str, current_state: str = "IDLE", user_profile: Dict[str, Any] = None) -> ReasonerResult:
    """
    Analyzes the message to determine intent and entities.
    """
    # 1. Check for Fast Path (Hard-coded Keywords)
    body_clean = message.strip().upper()
    
    # Priority Keywords (Global Interrupts)
    if body_clean == "RESET":
        return ReasonerResult("RESET", 1.0, {})
    if body_clean in ["PLAY", "START"]:
        return ReasonerResult("START_MATCH", 1.0, {})
    if body_clean == "GROUPS":
        return ReasonerResult("JOIN_GROUP", 1.0, {})
    if body_clean in ["MATCHES", "NEXT"]:
        return ReasonerResult("CHECK_STATUS", 1.0, {})

    # 2. Check for Simple Choices (Regex-like)
    if body_clean.isdigit():
        return ReasonerResult("CHOOSE_OPTION", 0.9, {"selection": int(body_clean)})

    # 3. Slow Path (Gemini REST API)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply='{"error": "Missing GEMINI_API_KEY"}')

    prompt = PROMPT_TEMPLATE.format(
        message=message,
        current_state=current_state,
        user_profile=json.dumps(user_profile or {}),
    )

    max_retries = 3
    retry_delay = 1.0
    model_name = os.getenv("LLM_MODEL_NAME", "gemini-2.0-flash")

    for attempt in range(max_retries + 1):
        try:
            res_text = call_gemini_api(prompt, api_key, model_name)
            
            if res_text:
                # Attempt to parse JSON
                clean_text = res_text.strip()
                if "```json" in clean_text:
                    clean_text = clean_text.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_text:
                    clean_text = clean_text.split("```")[1].split("```")[0].strip()
                    
                data = json.loads(clean_text)
                return ReasonerResult(
                    intent=data.get("intent", "UNKNOWN"),
                    confidence=data.get("confidence", 0.0),
                    entities=data.get("entities", {}),
                    raw_reply=clean_text
                )
            
            # If we got here and res_text is None, it might have been a transient error captured in logs
            # We can retry if loop continues, but call_gemini_api handles its own single request.
            # Ideally call_gemini_api would raise for us to catch/retry here. 
            # For simplicity, let's treat None as a failure worthy of retry if it was a network issue.
            
            if attempt < max_retries:
                 # Exponential backoff
                sleep_time = retry_delay * (2 ** attempt) + (random.random() * 0.5)
                time.sleep(sleep_time)
                continue
            
        except Exception as e:
            print(f"[REASONER] Logic Error: {e}")
            if attempt < max_retries:
                time.sleep(1)
            else:
                return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply=f'{{"error": "{str(e)}"}}')

    return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply='{"error": "Failed to generate response after retries"}')

