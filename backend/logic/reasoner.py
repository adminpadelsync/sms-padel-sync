import os
import json
import google.generativeai as genai
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

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
- JOIN_GROUP: Wanting to join a specific group (Look for "groups", number selections).
- SET_AVAILABILITY: Providing availability (Look for "mornings", "weekends", "anytime").
- CHECK_STATUS: Asking for match invites or next matches (Look for "matches", "next", "status").
- MUTE: Wanting to pause invites (Look for "mute", "pause", "stop").
- UNMUTE: Resuming invites (Look for "unmute", "resume", "start").
- RESET: Wanting to start over or clear state.
- GREETING: Just saying hello.
- CHITCHAT: General banter or feedback.
- UNKNOWN: None of the above.

### Entities to extract:
- date: e.g., "Sunday", "Tomorrow", "Dec 20".
- time: e.g., "4pm", "18:00", "afternoon".
- selection: e.g., "1", "first one", "top one" (convert to integer if possible).
- skill_level: e.g., "3.5", "intermediate", "C".
- gender: e.g., "male", "female".

### Output Format:
Return ONLY a JSON object:
{{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "entities": {{
    "date": "...",
    "time": "...",
    "selection": ...,
    "skill_level": "...",
    "gender": "..."
  }},
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
    if body_clean == "MATCHES":
        return ReasonerResult("CHECK_STATUS", 1.0, {})

    # 2. Check for Simple Choices (Regex-like)
    if body_clean.isdigit():
        return ReasonerResult("CHOOSE_OPTION", 0.9, {"selection": int(body_clean)})

    # 3. Slow Path (Gemini)
    if not api_key:
        # Fallback to UNKNOWN if no API key
        return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply='{"error": "Missing GEMINI_API_KEY"}')

    prompt = PROMPT_TEMPLATE.format(
        message=message,
        current_state=current_state,
        user_profile=json.dumps(user_profile or {}),
    )

    try:
        # Try primary model (Flash - faster/cheaper)
        try:
             model = genai.GenerativeModel('gemini-1.5-flash')
             response = model.generate_content(prompt)
        except Exception:
             # Fallback to Pro (older but reliable)
             print("Warning: gemini-1.5-flash failed, falling back to gemini-pro")
             model = genai.GenerativeModel('gemini-pro')
             response = model.generate_content(prompt)

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
            available_models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    available_models.append(m.name)
            error_msg = f"API Error: {str(e)}. Available Models: {', '.join(available_models)}"
        except Exception as list_err:
            error_msg = f"API Error: {str(e)}. Could not list models: {str(list_err)}"
            
        return ReasonerResult("UNKNOWN", 0.0, {}, raw_reply=f'{{"error": "{error_msg}"}}')
