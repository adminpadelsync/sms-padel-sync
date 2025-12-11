"""
Error logging module for SMS system debugging.
Logs errors to Supabase error_logs table for persistent debugging.
"""
import traceback
from datetime import datetime
from database import supabase


def log_error(
    error_type: str,
    error_message: str,
    phone_number: str = None,
    player_id: str = None,
    club_id: str = None,
    sms_body: str = None,
    handler_name: str = None,
    exception: Exception = None,
    additional_context: dict = None
):
    """
    Log an error to the error_logs table.
    
    Args:
        error_type: Category of error (e.g., 'match_creation', 'invite_response')
        error_message: Human-readable error description
        phone_number: User's phone number if available
        player_id: Player UUID if available
        club_id: Club UUID if available
        sms_body: The SMS message that triggered the error
        handler_name: Name of the handler function where error occurred
        exception: The exception object if available
        additional_context: Any additional debug info as dict
    """
    try:
        # Get stack trace if exception provided
        stack_trace = None
        if exception:
            stack_trace = ''.join(traceback.format_exception(
                type(exception), exception, exception.__traceback__
            ))
        
        error_data = {
            "error_type": error_type,
            "error_message": str(error_message),
            "phone_number": phone_number,
            "player_id": player_id,
            "club_id": club_id,
            "sms_body": sms_body,
            "handler_name": handler_name,
            "stack_trace": stack_trace,
            "additional_context": additional_context
        }
        
        # Remove None values
        error_data = {k: v for k, v in error_data.items() if v is not None}
        
        supabase.table("error_logs").insert(error_data).execute()
        print(f"[ERROR_LOG] {error_type}: {error_message}")
        
    except Exception as log_error:
        # Don't let logging errors break the app
        print(f"[ERROR_LOG] Failed to log error: {log_error}")
        print(f"[ERROR_LOG] Original error: {error_type} - {error_message}")


def log_match_error(
    error_message: str,
    phone_number: str,
    player: dict = None,
    sms_body: str = None,
    exception: Exception = None,
    context: dict = None
):
    """Convenience function for match-related errors."""
    log_error(
        error_type="match_creation",
        error_message=error_message,
        phone_number=phone_number,
        player_id=player.get("player_id") if player else None,
        club_id=player.get("club_id") if player else None,
        sms_body=sms_body,
        handler_name="match_handler",
        exception=exception,
        additional_context=context
    )


def log_invite_error(
    error_message: str,
    phone_number: str,
    player: dict = None,
    match_id: str = None,
    exception: Exception = None
):
    """Convenience function for invite-related errors."""
    log_error(
        error_type="invite_response",
        error_message=error_message,
        phone_number=phone_number,
        player_id=player.get("player_id") if player else None,
        club_id=player.get("club_id") if player else None,
        handler_name="invite_handler",
        exception=exception,
        additional_context={"match_id": match_id} if match_id else None
    )


def log_sms_error(
    error_message: str,
    phone_number: str,
    sms_body: str = None,
    exception: Exception = None
):
    """Convenience function for general SMS processing errors."""
    log_error(
        error_type="sms_processing",
        error_message=error_message,
        phone_number=phone_number,
        sms_body=sms_body,
        handler_name="sms_handler",
        exception=exception
    )
