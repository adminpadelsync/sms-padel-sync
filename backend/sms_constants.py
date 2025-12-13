# SMS Messages
MSG_WELCOME_BACK = "Welcome back to {club_name}, {name}! Text 'PLAY' to request a match."
MSG_WELCOME_NEW = "Welcome to {club_name}! Let's get you set up. First, what is your full name?"
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
MSG_ASK_AVAILABILITY = "Got it! Last question: When do you usually like to play? (e.g., 'Weekdays after 6pm', 'Sat mornings')"
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
MSG_MATCH_REQUESTED_VOTING = "Voting match created! We found {count} players to invite to vote on times."
MSG_MATCH_REQUESTED_CONFIRMED = "🎾 {club_name}: Match requested for {time}! Inviting {count} players now. We'll let you know when they respond."
MSG_MATCH_CREATION_ERROR = "Something went wrong creating your match request."
MSG_MATCH_FULL = "Sorry, this match just filled up! We'll let you know about the next one."
MSG_MATCH_ALREADY_FULL = "Sorry, this match is already full or cancelled."
MSG_YOU_ARE_IN = "You're in at {club_name}! We'll confirm once we have 4 players."

MSG_UPDATE_JOINED = "🎾 {club_name}: {name} just joined! {spots} spot(s) left. Reply YES to grab a spot."
MSG_MATCH_CONFIRMED = "MATCH CONFIRMED at {club_name}! {time}. See you on the court!"

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

# States
STATE_NEW = "NEW"
STATE_WAITING_NAME = "WAITING_NAME"
STATE_WAITING_LEVEL = "WAITING_LEVEL"
STATE_WAITING_GENDER = "WAITING_GENDER"
STATE_WAITING_AVAILABILITY = "WAITING_AVAILABILITY"
STATE_MATCH_REQUEST_DATE = "MATCH_REQUEST_DATE"
STATE_MATCH_REQUEST_CONFIRM = "MATCH_REQUEST_CONFIRM"
STATE_MATCH_GROUP_SELECTION = "MATCH_GROUP_SELECTION"
STATE_MATCH_REQUEST_DURATION = "MATCH_REQUEST_DURATION"
STATE_COMPLETED = "COMPLETED"
STATE_WAITING_FEEDBACK = "WAITING_FEEDBACK"

# Feedback Collection
MSG_FEEDBACK_REQUEST = """🎾 {club_name}: On a scale of 1-10, how likely are you to play in a match again with:

1. {player1_name}
2. {player2_name}
3. {player3_name}

Reply with 3 numbers separated by spaces (e.g., "8 7 9")
Reply SKIP to skip feedback."""

MSG_FEEDBACK_THANKS = "Thanks for your feedback! This helps us create better matches for you."
MSG_FEEDBACK_INVALID = "Please reply with 3 numbers (1-10) separated by spaces, e.g., '8 7 9'"
MSG_FEEDBACK_SKIPPED = "No problem! We'll ask again next time."

