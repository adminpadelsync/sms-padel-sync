import os
import json
import requests
import time
import random
import re
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from sms_constants import INTENT_DESCRIPTIONS
from error_logger import log_sms_error
from llm_config import LLMConfig

load_dotenv()

# Gemini REST API Configuration
GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

def extract_json_from_text(text: str) -> Optional[Any]:
    """
    Robustly extracts JSON from a string, handling markdown code blocks and extra text.
    """
    if not text:
        return None
        
    clean_text = text.strip()
    
    # 1. Try to find markdown blocks
    if "```json" in clean_text:
        clean_text = clean_text.split("```json")[1].split("```")[0].strip()
    elif "```" in clean_text:
        clean_text = clean_text.split("```")[1].split("```")[0].strip()
    
    # 2. Try to parse cleaned text
    try:
        return json.loads(clean_text)
    except json.JSONDecodeError:
        pass
        
    # 3. Fallback: Find first/last brace/bracket
    # Determine if we're looking for an object or list
    first_brace = clean_text.find('{')
    first_bracket = clean_text.find('[')
    
    start_index = -1
    end_char = ''
    
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        start_index = first_brace
        end_char = '}'
    elif first_bracket != -1:
        start_index = first_bracket
        end_char = ']'
        
    if start_index != -1:
        end_index = clean_text.rfind(end_char)
        if end_index != -1:
            candidate = clean_text[start_index:end_index+1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
                
    return None

class ReasonerResult:
    def __init__(self, intent: str, confidence: float, entities: Dict[str, Any], reply_text: Optional[str] = None, raw_reply: Optional[str] = None):
        self.intent = intent
        self.confidence = confidence
        self.entities = entities
        self.reply_text = reply_text
        self.raw_reply = raw_reply

    def __repr__(self):
        return f"ReasonerResult(intent={self.intent}, confidence={self.confidence}, entities={self.entities}, reply_text={self.reply_text})"

def get_intents_prompt():
    return "\n".join([f"- {k}: {v}" for k, v in INTENT_DESCRIPTIONS.items()])

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
{intents_list}

### Entities to extract:
- date: e.g., "Sunday", "Tomorrow", "Dec 20".
- time: e.g., "4pm", "18:00", "afternoon".
- selection: e.g., "1", "first one" (for groups).
- ratings: e.g., [1, 9, 8] (list of integers).
- skill_level: e.g., "3.5", "intermediate", "C".
- gender: e.g., "male", "female".
- score: e.g., "6-4 6-2", "tiebreak 10-8".
- winner: e.g., "Team 1", "Me", "Opponents". (Avoid putting participant names here if you can put them in team_a/team_b).
- team_a: e.g., ["Me", "Dave"] (List of names for the winning team).
- team_b: e.g., ["Sarah", "Mike"] (List of names for the losing team).
- court_text: e.g., "Court 6", "Court 4", "Indoor 2" (name or number of the booked court).
- suggested_time: e.g., "7pm", "18:00", "tomorrow morning" (suggested alternative time when declining).

### Instructions for Generating Reply:
- If the intent is GREETING, respond warmly and ask how you can help.
- If the intent is CHITCHAT, engage briefly and steer back to Padel if appropriate.
- If info is missing (e.g. START_MATCH but no time), ask for it naturally.
- If the user provides a partial update (like "5pm instead"), acknowledge the full updated date/time (e.g. "Got it, shifting to tomorrow at 5pm") to confirm context is preserved.
- When in "STATE_MATCH_GROUP_SELECTION", if the user mentions a group name or number (e.g., "Intermediate"), extract it as an entity "selection", but DO NOT switch to JOIN_GROUP intent. Keep it as the current intent (START_MATCH) or a generic SELECT_OPTION. JOIN_GROUP is ONLY for browsing/joining club groups.
- If the user asks "what groups am i in", "my groups", or similar, identify the JOIN_GROUP intent. Review their current memberships in the profile (group_names).
  - If they are in no groups, reply warmly: "Hey {{name}}, you don't belong to any groups right now, but here are some groups you can join if you'd like."
  - If they are in groups, say: "Hey {{name}}, you're currently in {{group_names}}. Here's the full list of groups you can manage:"
- If the user is NOT a member of the club (check 'is_member' in user profile, or if profile is empty/null), any message like "START", "HELLO", or even "PLAY" should be classified as a GREETING. The priority is to welcome them and get them onboarded. Do NOT classify as START_MATCH if they are not yet a member.
- Be concise, friendly, and act like a helpful Padel club manager.
- ALWAYS use the player's name if provided in the profile.
- If there is a "Pending Context" regarding a match invite, prioritize ACCEPT_INVITE or DECLINE_INVITE intents for responses like "Yes", "No", "I'm in", etc.
- If the user declines but suggests another time (e.g. "No, but I can do 7pm"), use intent DECLINE_WITH_ALTERNATIVE and extract the suggested_time.
- AMBIGUITY HANDLING: If the user provides a day/time (e.g. "Sun" or "9am") immediately after having just declined a match with a suggestion (check status 'declined' in pending context), treat it as a correction to their suggested_time (DECLINE_WITH_ALTERNATIVE) rather than a "Yes" to the original match.
- NEVER promise or confirm that a player is "In" or "Confirmed" for a match in your `reply_text` for ACCEPT_INVITE. The system will send its own confirmation after validating spots. Your reply should be supportive but neutral (e.g., "Got it! Sending that update now.").
- If you see a match in "Pending Context" with status 'declined', ignore it for the purpose of ACCEPT_INVITE unless the user explicitly says something like "Actually I can play that match after all".
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

def call_gemini_api(prompt: str, api_key: str, model_name: str = None, timeout: int = 25) -> Optional[str]:
    """Helper to call Gemini via REST API to avoid SDK dependency issues."""
    model_name = model_name or LLMConfig.get_model_name()
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
    
    # try/except removed to allow caller to handle/log specific exceptions
    response = requests.post(url, headers=headers, json=payload, timeout=timeout)
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
    api_key = LLMConfig.get_api_key()
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
        golden_samples=samples_str,
        intents_list=get_intents_prompt()
    )

    max_retries = 3
    retry_delay = 1.0
    model_name = LLMConfig.get_model_name()
    timeout = LLMConfig.get_timeout()

    for attempt in range(max_retries + 1):
        try:
            res_text = call_gemini_api(prompt, api_key, model_name, timeout=timeout)
            
            if res_text:
                data = extract_json_from_text(res_text)
                if data:
                    return ReasonerResult(
                        intent=data.get("intent", "UNKNOWN"),
                        confidence=data.get("confidence", 0.0),
                        entities=data.get("entities", {}),
                        reply_text=data.get("reply_text"),
                        raw_reply=res_text
                    )
            
            if attempt < max_retries:
                 # Exponential backoff
                sleep_time = retry_delay * (2 ** attempt) + (random.random() * 0.5)
                time.sleep(sleep_time)
                continue
            
        except Exception as e:
            print(f"[REASONER] Logic Error: {e}")
            
            # Log to DB for persistent debugging
            log_sms_error(
                error_message=f"Reasoner Logic Error: {str(e)}",
                phone_number=user_profile.get("phone_number") if user_profile else None,
                sms_body=message,
                exception=e
            )
            
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
    api_key = LLMConfig.get_api_key()
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

    model_name = LLMConfig.get_model_name()
    timeout = LLMConfig.get_timeout()
    
    try:
        res_text = call_gemini_api(prompt, api_key, model_name, timeout=timeout)
        if res_text:
            data = extract_json_from_text(res_text)
            if data:
                return {
                    "player_id": data.get("player_id"),
                    "confidence": data.get("confidence", 0.0),
                    "reasoning": data.get("reasoning", "")
                }
    except Exception as e:
        print(f"[REASONER] Name Resolution Logic Error: {e}")
        
    return {"player_id": None, "confidence": 0.0, "reasoning": "Error occurred"}

DETAILED_RESULTS_PROMPT = """
You are a Padel Match Scorer.
Your task is to extract one or more match results from a user's text message.
The user might report a single match, or multiple partial matches (sets) with different partners.

User Message: "{message}"

Players in the session:
{players_json}

Instruction:
1. Identify all distinct match or set results reported.
2. For each result, identify:
   - team_1: List of 2 player IDs.
   - team_2: List of 2 player IDs.
   - score: The score string (e.g. "6-4", "6-2 6-1").
   - winner: "team_1", "team_2", or "draw".
3. Handle "we", "us", "me" by mapping them to the sender ({sender_name}, ID: {sender_id}).
4. If the partners change (partner swapping), treat each configuration as a separate result.
5. IF the message implies a tie/draw (e.g. "1-1 in sets", "tied", "drew"), set winner to "draw".

Output ONLY a JSON list of objects:
[
  {{
    "team_1": ["ID1", "ID2"],
    "team_2": ["ID3", "ID4"],
    "score": "6-4",
    "winner": "team_1"
  }},
  ...
]
"""

def extract_detailed_match_results(message: str, players: List[Dict[str, Any]], sender_id: str) -> List[Dict[str, Any]]:
    """
    Uses LLM to extract detailed match results, handling partner swapping and ties.
    """
    api_key = LLMConfig.get_api_key()
    if not api_key:
        return []

    sender = next((p for p in players if p["player_id"] == sender_id), None)
    sender_name = sender["name"] if sender else "Unknown"

    players_simple = [{"id": p["player_id"], "name": p["name"]} for p in players]
    
    prompt = DETAILED_RESULTS_PROMPT.format(
        message=message,
        players_json=json.dumps(players_simple, indent=2),
        sender_name=sender_name,
        sender_id=sender_id
    )

    model_name = LLMConfig.get_model_name()
    timeout = LLMConfig.get_timeout()
    
    try:
        res_text = call_gemini_api(prompt, api_key, model_name, timeout=timeout)
        if res_text:
            data = extract_json_from_text(res_text)
            
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
            
    except Exception as e:
        print(f"[REASONER] Detailed Result Extraction Error: {e}")
        
    return []
