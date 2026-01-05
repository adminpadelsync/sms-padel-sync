from typing import List, Dict, Any
from handlers.sms.dispatcher import IntentDispatcher

# Global dispatcher instance
dispatcher = IntentDispatcher()

def handle_incoming_sms(from_number: str, body: str, to_number: str = None, club_id: str = None, dry_run: bool = False, history: List[Dict[str, str]] = None, golden_samples: List[Dict[str, Any]] = None):
    """
    Handle incoming SMS messages via the modular IntentDispatcher.
    
    Args:
        from_number: The sender's phone number
        body: The message content
        to_number: The Twilio number that received the SMS (determines which club)
        club_id: Explicit club ID (overrides to_number lookup, useful for Training Jig)
        dry_run: If True, capture responses instead of sending
        history: Previous message history for the reasoner
        golden_samples: Few-shot examples for the reasoner
    """
    return dispatcher.handle_sms(
        from_number=from_number, 
        body=body, 
        to_number=to_number, 
        club_id=club_id, 
        dry_run=dry_run, 
        history=history, 
        golden_samples=golden_samples
    )
