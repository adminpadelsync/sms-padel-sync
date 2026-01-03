import re
from typing import Optional, Tuple
from datetime import datetime, timedelta


def _parse_gender(text: str) -> Optional[str]:
    """
    Parse gender preference from response.
    Returns 'male', 'female', 'mixed', or None.
    """
    text_upper = text.upper()
    
    # Check for explicit E (Either/Mixed)
    if re.search(r'\bE\b', text_upper) or 'EITHER' in text_upper or 'MIXED' in text_upper:
        return "mixed"
    
    # Check for explicit M or F (not part of other words)
    if re.search(r'\bM\b', text_upper) or 'MALE' in text_upper and 'FEMALE' not in text_upper:
        return "male"
    if re.search(r'\bF\b', text_upper) or 'FEMALE' in text_upper:
        return "female"
    
    return None


def _parse_level_range(text: str) -> Optional[tuple]:
    """
    Parse level range from response.
    Supports formats like "3.0-4.0" or "3.5 - 4.5".
    """
    # Pattern: number-number or number to number
    pattern = r'(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)'
    match = re.search(pattern, text.lower())
    
    if match:
        try:
            level_min = float(match.group(1))
            level_max = float(match.group(2))
            
            # Validate reasonable skill levels
            if 2.0 <= level_min <= 5.5 and 2.0 <= level_max <= 5.5 and level_min <= level_max:
                return (level_min, level_max)
        except ValueError:
            pass
    
    return None
from database import supabase
from twilio_client import send_sms, get_club_name
from redis_client import clear_user_state, set_user_state
import sms_constants as msg
from logic_utils import get_club_timezone, format_sms_datetime, parse_iso_datetime
from handlers.date_parser import parse_natural_date, parse_natural_date_with_context

from error_logger import log_match_error



# Default match preferences
DEFAULT_LEVEL_RANGE = 0.25
DEFAULT_GENDER = "Mixed"


def handle_match_date_input(from_number: str, body: str, player: dict, entities: Optional[dict] = None):
    """
    Handle date/time input for match request (first phase).
    Parses natural language input. If player is in groups, asks group first.
    Otherwise, asks for preferences confirmation.
    """
    date_str = body.strip()
    
    # 1. Use pre-extracted entities if available (from Reasoner)
    parsed_dt = None
    human_readable = None
    iso_format = None
    
    # Get club's timezone
    club_id = player.get("club_id")
    timezone_str = get_club_timezone(club_id) if club_id else "America/New_York"
    
    if entities:
        # Check if we have a date and time entity
        ent_date = entities.get("date")
        ent_time = entities.get("time")
        if ent_date or ent_time:
            # Reconstruct string for parser or use directly if already parsed
            # For now, we Re-parse the entities to ensure consistent formatting
            ent_msg = f"{ent_date or ''} {ent_time or ''}".strip()
            parsed_dt, human_readable, iso_format = parse_natural_date(ent_msg, timezone=timezone_str)

    # 2. Fallback to parsing the body if no entities or entities failed
    if parsed_dt is None:
        # Check for Range (e.g., "2023-12-01 14:00-18:00") - keep existing voting flow
        if "-" in date_str and len(date_str.split("-")) >= 4:
            _handle_range_match(from_number, date_str, player)
            return
        
        # Try NLP parsing
        parsed_dt, human_readable, iso_format = parse_natural_date(date_str, timezone=timezone_str)

    
    if parsed_dt is None:
        # Fallback: Try strict YYYY-MM-DD HH:MM format
        try:
            scheduled_time = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
            parsed_dt = scheduled_time
            human_readable = format_sms_datetime(parsed_dt)
            iso_format = scheduled_time.isoformat()
        except ValueError:
            pass
    
    if parsed_dt is None:
        # Neither worked - if the body was just "play" or similar, ask friendly
        if body.lower().strip() in ["play", "start", "match"]:
            send_sms(from_number, msg.MSG_REQUEST_DATE.format(club_name=get_club_name()))
            # Set state to wait for date
            set_user_state(from_number, msg.STATE_MATCH_REQUEST_DATE)
        else:
            # Re-ask if they sent something we couldn't parse
            send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)
        return
    
    # Date parsed successfully - check if we should auto-scope to a group
    auto_group_id = entities.get("group_id") if entities else None
    
    if auto_group_id:
        # BYPASS group selection - auto-scope to this group
        # We still want to get the group name for confirmation
        group_res = supabase.table("player_groups").select("name").eq("group_id", auto_group_id).maybe_single().execute()
        group_name = group_res.data["name"] if group_res.data else "your group"
        
        # Create match immediately with group context
        _create_match(
            from_number,
            iso_format,
            human_readable,
            player,
            level_min=None,
            level_max=None,
            gender_preference=None,
            target_group_id=auto_group_id,
            skip_filters=True,
            group_name=group_name,
            friendly_time=format_sms_datetime(parsed_dt)
        )
        return

    # No auto-scope - check if player is manually in groups
    groups_res = supabase.table("group_memberships").select(
        "group_id, player_groups(name)"
    ).eq("player_id", player["player_id"]).execute()
    
    if groups_res.data:
        # Player is in groups - ask group selection FIRST with time confirmation
        groups_data = groups_res.data
        
        # Format list - start at 2 since 1 is Everyone
        groups_list = ""
        group_options = {}
        for idx, item in enumerate(groups_data, 2):
            group_name = item.get("player_groups", {}).get("name", "Unknown Group")
            groups_list += f"{idx}) {group_name}\n"
            group_options[str(idx)] = {
                "group_id": item["group_id"],
                "group_name": group_name
            }
        
        send_sms(from_number, msg.MSG_ASK_GROUP_WITH_TIME.format(
            club_name=get_club_name(),
            time=human_readable,
            groups_list=groups_list
        ))
        
        # Store state for group selection
        set_user_state(from_number, msg.STATE_MATCH_GROUP_SELECTION, {
            "scheduled_time_iso": iso_format,
            "scheduled_time_human": human_readable,
            "group_options": group_options
        })
    else:
        # Player not in any groups - go directly to preferences
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)


def _send_preferences_confirmation(from_number: str, human_readable: str, iso_format: str, player: dict):
    """
    Send confirmation message with match preferences.
    Gender defaults to player's own gender.
    """
    player_level = player.get("declared_skill_level", 3.5) if player else 3.5
    player_gender = player.get("gender", "male") if player else "male"
    
    # Calculate default level range
    level_min = max(2.0, player_level - DEFAULT_LEVEL_RANGE)
    level_max = min(5.5, player_level + DEFAULT_LEVEL_RANGE)
    
    # Gender display
    gender_display = {"male": "Male", "female": "Female"}.get(player_gender, "Mixed")
    gender_preference = player_gender if player_gender in ["male", "female"] else "mixed"
    
    # Format for display
    friendly_time = format_sms_datetime(parse_iso_datetime(iso_format))
    confirm_msg = msg.MSG_CONFIRM_DATE_WITH_PREFS.format(
        club_name=get_club_name(),
        time=friendly_time,
        level=player_level,
        range=DEFAULT_LEVEL_RANGE,
        gender=gender_display
    )
    
    send_sms(from_number, confirm_msg)
    
    # Store in state for confirmation step
    set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
        "scheduled_time_iso": iso_format,
        "scheduled_time_human": human_readable,
        "level_min": level_min,
        "level_max": level_max,
        "gender_preference": gender_preference
    })


def handle_match_confirmation(from_number: str, body: str, player: dict, state_data: dict, entities: Optional[dict] = None):
    """
    Handle confirmation of parsed date/time with preferences (second phase).
    Parses gender (M/F) and level range (e.g., 3.0-4.0).
    """
    response = body.strip()
    response_lower = response.lower()
    
    # Extract current state
    scheduled_time_iso = state_data.get("scheduled_time_iso")
    scheduled_time_human = state_data.get("scheduled_time_human")
    # Convert to float since Redis stores as strings in JSON
    level_min = float(state_data.get("level_min", 3.0))
    level_max = float(state_data.get("level_max", 4.0))
    gender_preference = state_data.get("gender_preference", "mixed")
    
    if not scheduled_time_iso:
        send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)
        clear_user_state(from_number)
        return
    
    # Check for cancel
    if response_lower in ["no", "n", "cancel", "nope"]:
        send_sms(from_number, msg.MSG_DATE_CANCELLED)
        clear_user_state(from_number)
        return
    
    # Check for MUTE command during confirmation
    if response_lower == "mute":
        _handle_mute(from_number, player)
        clear_user_state(from_number)
        return
    
    # Parse modifications from the response
    new_gender = _parse_gender(response)
    new_level_range = _parse_level_range(response)
    
    # Update preferences if provided
    if new_gender:
        gender_preference = new_gender
    if new_level_range:
        level_min, level_max = new_level_range
    
    # Check if this is a confirmation (contains YES or is just M/F/level adjustment)
    is_confirmation = any(word in response_lower for word in ["yes", "y", "confirm", "ok", "yep", "yeah"])
    is_adjustment_only = (new_gender or new_level_range) and not is_confirmation
    
    if is_adjustment_only:
        # User adjusted preferences but didn't confirm - show updated confirmation
        player_level = player.get("declared_skill_level", 3.5) if player else 3.5
        range_display = (level_max - level_min) / 2
        gender_display = {"mixed": "Mixed", "male": "Male-only", "female": "Female-only"}.get(gender_preference, "Mixed")
        
        confirm_msg = msg.MSG_CONFIRM_DATE_WITH_PREFS.format(
            club_name=get_club_name(),
            time=scheduled_time_human,
            level=player_level,
            range=range_display,
            gender=gender_display
        )
        
        send_sms(from_number, confirm_msg)
        set_user_state(from_number, msg.STATE_MATCH_REQUEST_CONFIRM, {
            "scheduled_time_iso": scheduled_time_iso,
            "scheduled_time_human": scheduled_time_human,
            "level_min": level_min,
            "level_max": level_max,
            "gender_preference": gender_preference
        })
        return
    
    if is_confirmation or (new_gender or new_level_range):
        # User confirmed - create the match with preferences
        # Note: Group selection already happened in handle_match_date_input
        # If we're here, user either chose "Everyone" or isn't in any groups
        _create_match(
            from_number, 
            scheduled_time_iso, 
            scheduled_time_human, 
            player,
            level_min,
            level_max,
            gender_preference
        )
        return
    
    # Try parsing as a new date/time with context
    club_id = player.get("club_id")
    timezone_str = get_club_timezone(club_id) if club_id else "America/New_York"
    
    # Check entities first
    ent_date = entities.get("date") if entities else None
    ent_time = entities.get("time") if entities else None
    parse_input = response
    if ent_date or ent_time:
        parse_input = f"{ent_date or ''} {ent_time or ''}".strip()

    # Get base date from state for merging
    base_dt = parse_iso_datetime(scheduled_time_iso) if scheduled_time_iso else None
    parsed_dt, human_readable, iso_format = parse_natural_date_with_context(parse_input, base_dt=base_dt, timezone=timezone_str)

    
    if parsed_dt is not None:
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    
    # Fallback: Try strict format
    try:
        scheduled_time = datetime.strptime(response, "%Y-%m-%d %H:%M")
        human_readable = scheduled_time.strftime("%a, %b %d at %I:%M %p")
        iso_format = scheduled_time.isoformat()
        
        _send_preferences_confirmation(from_number, human_readable, iso_format, player)
        return
    except ValueError:
        pass
    
    # Still not understood
    send_sms(from_number, msg.MSG_DATE_NOT_UNDERSTOOD)


def handle_group_selection(from_number: str, body: str, player: dict, state_data: dict, entities: Optional[dict] = None):
    """
    Handle selection of group to invite.
    - If "1" (Everyone): go to preferences confirmation
    - If a group number: create match immediately, skip all filters
    """
    # Prioritize AI extracted selection (e.g. if user said "intermediate group", entity might be "2")
    ent_selection = entities.get("selection") if entities else None
    selection = str(ent_selection) if ent_selection is not None else body.strip()
    
    selection_lower = selection.lower()
    group_options = state_data.get("group_options", {})
    scheduled_time_iso = state_data.get("scheduled_time_iso")
    scheduled_time_human = state_data.get("scheduled_time_human")
    
    # Check for "Everyone" selection
    if selection == "1" or selection_lower == "everyone" or selection_lower == "all":
        # Go to preferences confirmation (full filtering flow)
        _send_preferences_confirmation(from_number, scheduled_time_human, scheduled_time_iso, player)
        return
    
    # Check for group selection
    if selection in group_options:
        group_info = group_options[selection]
        target_group_id = group_info.get("group_id") if isinstance(group_info, dict) else group_info
        group_name = group_info.get("group_name", "your group") if isinstance(group_info, dict) else "your group"
        
        # Create match immediately - NO filters, invite all group members
        _create_match(
            from_number,
            scheduled_time_iso,
            scheduled_time_human,
            player,
            level_min=None,  # No level filter
            level_max=None,  # No level filter
            gender_preference=None,  # No gender filter
            target_group_id=target_group_id,
            skip_filters=True,
            group_name=group_name
        )
        return
    
    # Check if user entered a new time instead of a number
    club_id = player.get("club_id")
    timezone_str = get_club_timezone(club_id) if club_id else "America/New_York"
    
    # Check entities first
    ent_date = entities.get("date") if entities else None
    ent_time = entities.get("time") if entities else None
    parse_input = selection
    if ent_date or ent_time:
        parse_input = f"{ent_date or ''} {ent_time or ''}".strip()

    # Get base date from state for merging
    base_dt = parse_iso_datetime(scheduled_time_iso) if scheduled_time_iso else None
    parsed_dt, human_readable, iso_format = parse_natural_date_with_context(parse_input, base_dt=base_dt, timezone=timezone_str)

    if parsed_dt is not None:
        # Re-show group selection with new time
        groups_list = ""
        for idx in sorted(group_options.keys(), key=int):
            group_info = group_options[idx]
            group_name = group_info.get("group_name", "Unknown") if isinstance(group_info, dict) else "Unknown"
            groups_list += f"{idx}) {group_name}\n"
        
        send_sms(from_number, msg.MSG_ASK_GROUP_WITH_TIME.format(
            club_name=get_club_name(),
            time=human_readable,
            groups_list=groups_list
        ))
        
        # Update state with new time
        set_user_state(from_number, msg.STATE_MATCH_GROUP_SELECTION, {
            "scheduled_time_iso": iso_format,
            "scheduled_time_human": human_readable,
            "group_options": group_options
        })
        return
    
    # Invalid selection
    send_sms(from_number, "Invalid selection. Please reply with 1 for Everyone or the number of your group.")





def _handle_mute(from_number: str, player: dict):
    """
    Mute player from receiving invites until end of day.
    """
    if not player:
        return
    
    # Set muted_until to end of today (midnight)
    tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    
    supabase.table("players").update({
        "muted_until": tomorrow.isoformat()
    }).eq("player_id", player["player_id"]).execute()
    
    send_sms(from_number, msg.MSG_MUTED)


def _create_match(
    from_number: str, 
    scheduled_time_iso: str, 
    scheduled_time_human: str, 
    player: dict,
    level_min: Optional[float] = None,
    level_max: Optional[float] = None,
    gender_preference: str = "mixed",
    target_group_id: Optional[str] = None,
    skip_filters: bool = False,
    group_name: str = None,
    friendly_time: str = None
):
    """
    Create match in database with preferences and trigger invites.
    If skip_filters is True, invites all group members regardless of level/gender.
    """
    if not player:
        send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
        clear_user_state(from_number)
        return
    
    try:
        match_data = {
            "club_id": player["club_id"],
            "team_1_players": [player["player_id"]],
            "team_2_players": [],
            "scheduled_time": scheduled_time_iso,
            "status": "pending",
            "level_range_min": level_min if not skip_filters else None,
            "level_range_max": level_max if not skip_filters else None,
            "gender_preference": gender_preference if not skip_filters else None,
            "target_group_id": target_group_id,
            "originator_id": player["player_id"]
        }
        
        # INSERT and use returned data to avoid race condition
        res = supabase.table("matches").insert(match_data).execute()
        clear_user_state(from_number)
        
        if res.data:
            match_id = res.data[0]["match_id"]
            from matchmaker import find_and_invite_players
            count = find_and_invite_players(match_id, skip_filters=skip_filters)
            
            # Use appropriate confirmation message
            # If friendly_time wasn't passed, calculate it
            if not friendly_time:
                friendly_time = format_sms_datetime(parse_iso_datetime(scheduled_time_iso))
                
            if skip_filters and group_name:
                send_sms(from_number, msg.MSG_MATCH_REQUESTED_GROUP.format(
                    club_name=get_club_name(), 
                    time=friendly_time, 
                    count=count,
                    group_name=group_name
                ))
            else:
                send_sms(from_number, msg.MSG_MATCH_REQUESTED_CONFIRMED.format(
                    club_name=get_club_name(), time=friendly_time, count=count
                ))
        else:
            send_sms(from_number, msg.MSG_MATCH_TRIGGER_FAIL)
            
    except Exception as e:
        log_match_error(
            error_message=str(e),
            phone_number=from_number,
            player=player,
            exception=e,
            context={
                "scheduled_time_iso": scheduled_time_iso,
                "level_min": level_min,
                "level_max": level_max,
                "gender_preference": gender_preference,
                "target_group_id": target_group_id,
                "skip_filters": skip_filters
            }
        )
        send_sms(from_number, msg.MSG_MATCH_CREATION_ERROR)


def _handle_range_match(from_number: str, date_str: str, player: dict):
    """
    Handle time range format for voting matches (existing functionality).
    """
    try:
        parts = date_str.split(" ")
        if len(parts) < 2:
            send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)
            return

        date_part = parts[0]
        time_range = parts[1]
        if "-" not in time_range:
            send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)
            return
             
        start_time_str, end_time_str = time_range.split("-")
        
        start_dt = datetime.strptime(f"{date_part} {start_time_str}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{date_part} {end_time_str}", "%Y-%m-%d %H:%M")
        
        # Generate 120-min slots
        slots = []
        current_slot = start_dt
        while current_slot + timedelta(minutes=120) <= end_dt:
            slots.append(current_slot.isoformat())
            current_slot += timedelta(minutes=120)
        
        if not slots:
            send_sms(from_number, msg.MSG_RANGE_TOO_SHORT)
            return

        if not player:
            send_sms(from_number, msg.MSG_PLAYER_NOT_FOUND)
            clear_user_state(from_number)
            return

        match_data = {
            "club_id": player["club_id"],
            "team_1_players": [player["player_id"]],
            "team_2_players": [],
            "scheduled_time": slots[0],
            "status": "voting",
            "voting_options": slots,
            "voting_deadline": (datetime.utcnow() + timedelta(hours=24)).isoformat()
        }
        
        res = supabase.table("matches").insert(match_data).execute()
        clear_user_state(from_number)
        
        if res.data:
            match_id = res.data[0]["match_id"]
            
            # Auto-vote for all options for the requester
            for slot in slots:
                vote_data = {
                    "match_id": match_id,
                    "player_id": player["player_id"],
                    "selected_option": slot
                }
                supabase.table("match_votes").insert(vote_data).execute()

            from matchmaker import find_and_invite_players
            count = find_and_invite_players(match_id)
            send_sms(from_number, msg.MSG_MATCH_REQUESTED_VOTING.format(club_name=get_club_name(), count=count))
        else:
            send_sms(from_number, msg.MSG_MATCH_TRIGGER_FAIL)

    except ValueError:
        send_sms(from_number, msg.MSG_INVALID_RANGE_FORMAT)


# Backwards compatibility alias
def handle_match_request(from_number: str, body: str, player: dict, entities: Optional[dict] = None):
    """
    Legacy function name for backwards compatibility.
    Routes to handle_match_date_input.
    """
    handle_match_date_input(from_number, body, player, entities)
