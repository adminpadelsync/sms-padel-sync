# SMS Messages
MSG_WELCOME_BACK = "Welcome back to {club_name}, {name}! Text 'PLAY' to request a match."
MSG_WELCOME_NEW = "Welcome to {club_name}! Let's get you set up. First, what is your full name (as it appears in {booking_system})?"
MSG_NAME_TOO_SHORT = "That name looks a bit short. Please enter your full name."
MSG_ASK_LEVEL = (
    "Nice to meet you, {name}! What is your Padel skill level? (Reply A-F)\n"
    "A) 2.5 (Beginner)\n"
    "B) 3.0\n"
    "C) 3.5 (Intermediate)\n"
    "D) 4.0\n"
    "E) 4.5 (Advanced)\n"
    "F) 5.0+ (Pro)"
)
MSG_INVALID_LEVEL = "Please reply with a letter A-F or the number (e.g., 3.5)."
MSG_ASK_GENDER = "Great! What is your gender? (Reply M for Male or F for Female)"
MSG_INVALID_GENDER = "Please reply with M (Male) or F (Female)."
MSG_ASK_AVAILABILITY_ONBOARDING = """Got it! Last question: When do you usually like to play?
A) Weekday mornings
B) Weekday afternoons
C) Weekday evenings
D) Weekend mornings
E) Weekend afternoons
F) Weekend evenings
G) Anytime

Reply with letters for all that apply (example: ACD)."""

MSG_ASK_AVAILABILITY_UPDATE = """When do you usually like to play?
A) Weekday mornings
B) Weekday afternoons
C) Weekday evenings
D) Weekend mornings
E) Weekend afternoons
F) Weekend evenings
G) Anytime

Reply with letters for all that apply (example: ACD)."""
MSG_PROFILE_SETUP_DONE = "You're all set with {club_name}! We'll text you when matches are available. Text 'PLAY' anytime to request a game."
MSG_PROFILE_ERROR = "Something went wrong saving your profile. Please try again later."
MSG_SYSTEM_ERROR = "System Error: No clubs configured. Please contact admin."

MSG_REQUEST_DATE = "🎾 {club_name}: When do you want to play? (e.g., 'tomorrow at 6pm', 'Saturday 2pm')"
MSG_CONFIRM_DATE_WITH_PREFS = """🎾 {club_name}
📅 {time}

Looking for:
• Level: {level} (± {range})
• Gender: {gender} (reply M, F, or E for Either)

Reply YES to confirm, or adjust:
• Enter level range like "3.0-4.0" """
MSG_CONFIRM_DATE = "📅 {time} - is that right? Reply YES to confirm or try a different time."
MSG_DATE_NOT_UNDERSTOOD = "Hmm, I didn't understand that. Try something like 'tomorrow at 6pm' or 'Saturday 2pm'."
MSG_DATE_CANCELLED = "No problem! Text PLAY anytime to request a match."
MSG_INVALID_DATE_FORMAT = "Invalid format. Please use YYYY-MM-DD HH:MM (e.g., 2023-11-25 18:00)."
MSG_RANGE_TOO_SHORT = "Range too short for a 120-min match."
MSG_PLAYER_NOT_FOUND = "Error: Player profile not found."
MSG_MATCH_REQUESTED_VOTING = "🎾 {club_name}: Voting match created! We found {count} players to invite to vote on times."
MSG_MATCH_REQUESTED_CONFIRMED = "🎾 {club_name}: Match requested for {time}! Inviting {count} players now. We'll let you know when they respond."
MSG_MATCH_REQUESTED_QUIET_HOURS = "🎾 {club_name}: Match requested! It's currently quiet hours, so we'll send out the invites at {resume_time} tomorrow. We'll let you know once they're sent!"
MSG_QUIET_HOURS_RESUMED = "🎾 {club_name}: Good morning! We've just sent out the invites for your match request on {time}."
MSG_MATCH_CREATION_ERROR = "Something went wrong creating your match request."
MSG_MATCH_FULL = "Sorry, this match just filled up! We'll let you know about the next one."
MSG_MATCH_ALREADY_FULL = "Sorry, this match is already full or cancelled."
MSG_YOU_ARE_IN = "You're in at {club_name}! We'll confirm once we have 4 players."

MSG_UPDATE_JOINED = "🎾 {club_name}: {name} just joined! {spots} spot(s) left. Reply YES to grab a spot."
MSG_MATCH_CONFIRMED = "MATCH CONFIRMED at {club_name}! {time}. See you on the court!"
MSG_MATCH_CONFIRMED_INITIATOR = "MATCH CONFIRMED at {club_name}! {time}.\n\nAs the organizer, please book the court here: {booking_url}\n\nAlternatively, call {club_name} at {club_phone} to book directly."
MSG_COURT_BOOKED = "🎾 {club_name}: Court booked! Match on {time} is on: {court_text}. See you there! 🏸"

MSG_DECLINE = "No problem! We'll ask you next time."
MSG_MAYBE = "Got it, we'll keep you updated as this match comes together and follow up with you if we still need players."

MSG_INVALID_RANGE_FORMAT = "Invalid range format. Use YYYY-MM-DD HH:MM-HH:MM (e.g., 2023-12-01 14:00-18:00)."
MSG_MATCH_TRIGGER_FAIL = "Match requested, but we couldn't trigger invites right now."

# MUTE Command
MSG_MUTED = "Got it! You won't receive match invites until tomorrow. Text UNMUTE anytime to opt back in."
MSG_UNMUTED = "Welcome back! You'll now receive match invites again."
MSG_ALREADY_MUTED = "You're already muted for today. Text UNMUTE to receive invites again."
MSG_NOT_MUTED = "You're not currently muted. Text MUTE if you'd like to pause invites for today."

MSG_ASK_GROUP_TARGET = """Who would you like to invite to this match?
1) Everyone
{groups_list}
Reply with a number."""

MSG_ASK_GROUP_WITH_TIME = """🎾 {club_name}
📅 {time}

Who would you like to invite?
1) Everyone
{groups_list}
Reply with a number, or a different time."""

MSG_MATCH_REQUESTED_GROUP = "🎾 {club_name}: Match requested for {time}! Inviting {count} players from {group_name}. We'll let you know when they respond."
MSG_DEADPOOL_NOTIFICATION = (
    "🎾 {club_name}: It looks like we've run out of players in the '{group_name}' group who can play at {time}.\n\n"
    "Would you like to broaden the search and invite everyone in the club? (Reply YES to broaden, or NO to cancel)"
)

# Group Management
MSG_ASK_GROUPS_ONBOARDING = "Would you like to join any player groups? (Reply with numbers, e.g. 1 3, or SKIP)\n\n{groups_list}"
MSG_GROUPS_LIST_AVAILABLE = "🎾 {club_name} Public Groups:\n\n{groups_list}\n\nReply with a number to join."
MSG_NO_PUBLIC_GROUPS = "🎾 {club_name} has no public groups available to join right now."
MSG_JOINED_GROUPS_SUCCESS = "Success! You've joined: {group_names}."

# Resilience & Nudges
MSG_NUDGE_GROUP_SELECTION = "I didn't catch that. Please reply with the number of the group you want to join (e.g., '1'), or text RESET."
MSG_NUDGE_GENERIC = "I'm not sure I understood. You can reply with a command like PLAY, MATCHES, or GROUPS, or text RESET to start over."
MSG_CORRECTION_PROMPT = "I think you want to {intent_desc}. Is that right? (Reply YES or NO)"

# States
STATE_NEW = "NEW"
STATE_WAITING_NAME = "WAITING_NAME"
STATE_WAITING_LEVEL = "WAITING_LEVEL"
STATE_WAITING_GENDER = "WAITING_GENDER"
STATE_WAITING_AVAILABILITY = "WAITING_AVAILABILITY"
STATE_WAITING_GROUPS_ONBOARDING = "WAITING_GROUPS_ONBOARDING"
STATE_MATCH_REQUEST_DATE = "MATCH_REQUEST_DATE"
STATE_MATCH_REQUEST_CONFIRM = "MATCH_REQUEST_CONFIRM"
STATE_MATCH_GROUP_SELECTION = "MATCH_GROUP_SELECTION"
STATE_MATCH_REQUEST_DURATION = "MATCH_REQUEST_DURATION"
STATE_COMPLETED = "COMPLETED"
STATE_WAITING_FEEDBACK = "WAITING_FEEDBACK"
STATE_UPDATING_AVAILABILITY = "UPDATING_AVAILABILITY"
STATE_BROWSING_GROUPS = "BROWSING_GROUPS"
STATE_DEADPOOL_REFILL = "DEADPOOL_REFILL"

# Feedback Collection
MSG_FEEDBACK_REQUEST = """🎾 {club_name}: Quick feedback for your match on {match_time}.
On a scale of 1-10, how likely are you to play again with:

1. {player1_name}
2. {player2_name}
3. {player3_name}

Reply with 3 numbers (e.g., "8 7 9") or SKIP."""

MSG_FEEDBACK_THANKS = "Thanks for your feedback! This helps us create better matches for you."
MSG_FEEDBACK_INVALID = "Please reply with 3 numbers (1-10) separated by spaces, e.g., '8 7 9' or SKIP."
MSG_FEEDBACK_SKIPPED = "No problem! We'll ask again next time."

