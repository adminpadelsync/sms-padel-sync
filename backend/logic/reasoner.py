import os
import json
# Lazy import to prevent Vercel boot crashes
# from google import genai 
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini Client
# api_key is passed directly to Client constructor in the function

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

    # 3. Slow Path (Gemini)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback to UNKNOWN if no API key
        return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply='{"error": "Missing GEMINI_API_KEY"}')

    prompt = PROMPT_TEMPLATE.format(
        message=message,
        current_state=current_state,
        user_profile=json.dumps(user_profile or {}),
    )

    try:
        # Lazy Import for Safety
        try:
            from google import genai
            from google.genai import types
        except ImportError as ie:
            print(f"[CRITICAL] Failed to import google-genai: {ie}")
            # Try to debug namespace
            try:
                import google
                print(f"[DEBUG] google package path: {getattr(google, '__path__', 'unknown')}")
            except:
                pass
            return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply=f'{{"error": "Dependency Error: {ie}"}}')

        # Client initialization
        import time
        import random

        client = genai.Client(api_key=api_key)
        model_name = os.getenv("LLM_MODEL_NAME", "gemini-2.0-flash")
        
        max_retries = 3
        retry_delay = 1.0  # Initial delay in seconds
        
        response = None
        for attempt in range(max_retries + 1):
            try:
                # generate_content signature is slightly different
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                break # Success!
            except Exception as e:
                # Check for 429 Rate Limit
                if "429" in str(e) and attempt < max_retries:
                    # Exponential backoff with jitter
                    sleep_time = retry_delay * (2 ** attempt) + (random.random() * 0.5)
                    print(f"[REASONER] 429 Rate Limit hit. Retrying in {sleep_time:.2f}s (Attempt {attempt + 1}/{max_retries})")
                    time.sleep(sleep_time)
                else:
                    # Reraise if not 429 or max retries reached
                    raise e

        # Attempt to parse JSON from response
        res_text = response.text.strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        
        data = json.loads(res_text)
        return ReasonerResult(
            intent=data.get("intent", "UNKNOWN"),
            confidence=data.get("confidence", 0.0),
            entities=data.get("entities", {}),
            raw_reply=res_text
        )
    except Exception as e:
        print(f"Error in reasoning: {e}")
        
        # Try to list available models to help debug
        try:
            from google import genai
            debug_client = genai.Client(api_key=api_key)
            available_models = []
            for m in debug_client.models.list():
                # Filter for generation support if possible, or just list all
                available_models.append(m.name)
            error_msg = f"API Error: {str(e)}. Available Models: {', '.join(available_models)}"
        except Exception as list_err:
            error_msg = f"API Error: {str(e)}. Could not list models: {str(list_err)}"
            
        return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply=f'{{"error": "{error_msg}"}}')
