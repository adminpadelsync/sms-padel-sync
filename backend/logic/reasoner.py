import os
import json
import requests
import time
import random
import re
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

# Gemini REST API Configuration
GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

class ReasonerResult:
    def __init__(self, intent: str, confidence: float, entities: Dict[str, Any], reply_text: Optional[str] = None, raw_reply: Optional[str] = None):
        self.intent = intent
        self.confidence = confidence
        self.entities = entities
        self.reply_text = reply_text
        self.raw_reply = raw_reply

    def __repr__(self):
        return f"ReasonerResult(intent={self.intent}, confidence={self.confidence}, entities={self.entities}, reply_text={self.reply_text})"

PROMPT_TEMPLATE = """
You are the reasoning engine for an SMS-based Padel Matchmaking application.
Your goal is to extract the user's intent, relevant entities, and generate a natural human-like reply.

Current User State: {current_state}
Current User Profile: {user_profile}

### Conversation History:
{history}

### Pending Context (CRITICAL):
{pending_context}

### Golden Samples (Follow these patterns):
{golden_samples}

### Intents:
- START_MATCH: Requesting to play a match (Look for "play", "match", "game").
- ACCEPT_INVITE: Specifically accepting a match invite (Look for "yes", "count me in", "i'm in").
- DECLINE_INVITE: Specifically declining a match invite (Look for "no", "can't make it", "not today").
- JOIN_GROUP: Viewing, joining, or managing player group memberships (Look for "groups", "what groups am i in", "join group", number selections LIKE "1", "2").
- SET_AVAILABILITY: Providing availability (Look for "mornings", "weekends", "anytime").
- CHECK_STATUS: Asking for match invites or next matches (Look for "matches", "next", "status").
- MUTE: Wanting to pause invites (Look for "mute", "pause", "stop").
- UNMUTE: Resuming invites (Look for "unmute", "resume", "start").
- SUBMIT_FEEDBACK: Providing numeric ratings for players (Look for sequence of numbers e.g. "1 9 8" or "10 10 10").
- REPORT_RESULT: Reporting the outcome of a match including teams and score (Look for "won", "lost", "score was", "beat").
- BOOK_COURT: Explicitly stating that a court has been booked (Look for "booked court", "i got court 6", "confirmed court 4").
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
- court_text: e.g., "Court 6", "Court 4", "Indoor 2" (name or number of the booked court).

### Instructions for Generating Reply:
- If the intent is GREETING, respond warmly and ask how you can help.
- If the intent is CHITCHAT, engage briefly and steer back to Padel if appropriate.
- If info is missing (e.g. START_MATCH but no time), ask for it naturally.
- If the user provides a partial update (like "5pm instead"), acknowledge the full updated date/time (e.g. "Got it, shifting to tomorrow at 5pm") to confirm context is preserved.
- When in "STATE_MATCH_GROUP_SELECTION", if the user mentions a group name or number (e.g., "Intermediate"), extract it as an entity "selection", but DO NOT switch to JOIN_GROUP intent. Keep it as the current intent (START_MATCH) or a generic SELECT_OPTION. JOIN_GROUP is ONLY for browsing/joining club groups.
- If the user asks "what groups am i in" or similar, use the JOIN_GROUP intent and reply warmly that you are checking their memberships now.
- If the user is NOT a member of the club (check 'is_member' in user profile, or if profile is empty/null), any message like "START", "HELLO", or even "PLAY" should be classified as a GREETING. The priority is to welcome them and get them onboarded. Do NOT classify as START_MATCH if they are not yet a member.
- Be concise, friendly, and act like a helpful Padel club manager.
- ALWAYS use the player's name if provided in the profile.
- If there is a "Pending Context" regarding a match invite, prioritize ACCEPT_INVITE or DECLINE_INVITE intents for responses like "Yes", "No", "I'm in", etc.
- Never say "Yes to what?" if there is an obvious pending invite or match context. Be proactive and assume they are responding to the most recent relevant event in the context.

### Output Format:
Return ONLY a JSON object:
{{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "entities": {{ ... }},
  "reply_text": "Your human-sounding SMS response to the user",
  "reasoning": "Brief explanation of why"
}}

User Message: "{message}"
"""

NAME_RESOLUTION_PROMPT = """
You are a helpful Padel club manager.
Your task is to resolve a name or nickname mentioned in an SMS to one of the 4 players in a specific match.

Mentioned Name: "{name_str}"

Candidate Players in this Match:
{candidates_json}

Instructions:
1. Identify which candidate player the name "{name_str}" most likely refers to.
2. Consider common nicknames (e.g., Tony for Anthony, Alex for Alexander, Dave for David/Davide).
3. If "{name_str}" matches multiple players equally well or is too ambiguous, set confidence low.
4. If "{name_str}" refers to "me" or "i", it's usually the sender of the message. In this case, match it to the player with the name matching the sender (if known) or return None with a specific reasoning.
5. Return ONLY a JSON object:
{{
  "player_id": "RESOLVED_PLAYER_ID_OR_NULL",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of the match"
}}
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

def reason_message(message: str, current_state: str = "IDLE", user_profile: Dict[str, Any] = None, history: List[Dict[str, str]] = None, golden_samples: List[Dict[str, Any]] = None, pending_context: Any = None) -> ReasonerResult:
    """
    Analyzes the message to determine intent and entities, and generates a human reply.
    """
    # 1. Check for Fast Path (Hard-coded Keywords)
    body_clean = message.strip().upper()
    
    # Priority Keywords (Global Interrupts)
    if body_clean == "RESET":
        return ReasonerResult("RESET", 1.0, {}, reply_text="System reset. How can I help you from scratch?")
    if body_clean == "PLAY":
        return ReasonerResult("START_MATCH", 1.0, {}, reply_text="Great! When would you like to play?")
    if body_clean == "GROUPS":
        return ReasonerResult("JOIN_GROUP", 1.0, {}, reply_text="Here are the available groups you can join.")
    if body_clean in ["MATCHES", "NEXT"]:
        return ReasonerResult("CHECK_STATUS", 1.0, {}, reply_text="Checking your upcoming matches now...")

    # 2. Check for Simple Choices (Regex-like) - Keep only literal digits or numbered responses (1Y, 1N)
    # We let the Reasoner handle "Yes!" or "No." now for better context.
    if body_clean.isdigit():
        return ReasonerResult("CHOOSE_OPTION", 0.9, {"selection": int(body_clean)}, reply_text=f"Got it, option {body_clean}.")
    
    # Handle literal numbered responses like "1Y" or "1N" as fast path
    numbered_match = re.match(r'^(\d+)([YNM])?$', body_clean)
    if numbered_match:
        # We'll let the dispatcher handle this, but identifying it here helps.
        # Actually, let's keep it in dispatcher for now.
        pass

    # 3. Slow Path (Gemini REST API)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ReasonerResult("UNKNOWN", 0.0, {}, reply_text="Sorry, I'm having trouble thinking right now (API Key missing).", raw_reply='{"error": "Missing GEMINI_API_KEY"}')

    # Format History
    history_str = "No previous messages."
    if history:
        history_str = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in history[-5:]]) # Last 5 messages

    # Format Golden Samples
    samples_str = "No specific patterns provided. Use your best judgment."
    if golden_samples:
        samples_str = json.dumps(golden_samples, indent=2)

    # Format Pending Context
    context_str = "None. User is starting fresh."
    if pending_context:
        if isinstance(pending_context, (dict, list)):
            context_str = json.dumps(pending_context, indent=2)
        else:
            context_str = str(pending_context)

    prompt = PROMPT_TEMPLATE.format(
        message=message,
        current_state=current_state,
        user_profile=json.dumps(user_profile or {}),
        history=history_str,
        pending_context=context_str,
        golden_samples=samples_str
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
                    reply_text=data.get("reply_text"),
                    raw_reply=clean_text
                )
            
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
                return ReasonerResult("UNKNOWN", 0.0, {}, reply_text="I encountered an error while processing your request.", raw_reply=f'{{"error": "{str(e)}"}}')

    return ReasonerResult("UNKNOWN", 0.0, {}, reply_text="I'm sorry, I timed out. Can you try again?", raw_reply='{"error": "Failed to generate response after retries"}')

def resolve_names_with_ai(name_str: str, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Use Gemini to resolve a nickname or fuzzy name to a specific player ID.
    Returns: {"player_id": str or None, "confidence": float, "reasoning": str}
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"player_id": None, "confidence": 0.0, "reasoning": "API key missing"}

    candidates_json = json.dumps([{
        "player_id": c["player_id"],
        "name": c["name"]
    } for c in candidates], indent=2)

    prompt = NAME_RESOLUTION_PROMPT.format(
        name_str=name_str,
        candidates_json=candidates_json
    )

    model_name = os.getenv("LLM_MODEL_NAME", "gemini-2.0-flash")
    
    try:
        res_text = call_gemini_api(prompt, api_key, model_name)
        if res_text:
            clean_text = res_text.strip()
            if "```json" in clean_text:
                clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_text:
                clean_text = clean_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(clean_text)
            return {
                "player_id": data.get("player_id"),
                "confidence": data.get("confidence", 0.0),
                "reasoning": data.get("reasoning", "")
            }
    except Exception as e:
        print(f"[REASONER] Name Resolution Logic Error: {e}")
        
    return {"player_id": None, "confidence": 0.0, "reasoning": "Error occurred"}

