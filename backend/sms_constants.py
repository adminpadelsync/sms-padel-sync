# SMS Messages
MSG_WELCOME_BACK = "Welcome back, {name}! Text 'PLAY' to request a match."
MSG_WELCOME_NEW = "Welcome to Padel Sync! Let's get you set up. First, what is your full name?"
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
MSG_ASK_AVAILABILITY = "Got it! Last question: When do you usually like to play? (e.g., 'Weekdays after 6pm', 'Sat mornings')"
MSG_PROFILE_SETUP_DONE = "You're all set! We'll text you when matches are available. Text 'PLAY' anytime to request a game."
MSG_PROFILE_ERROR = "Something went wrong saving your profile. Please try again later."
MSG_SYSTEM_ERROR = "System Error: No clubs configured. Please contact admin."

MSG_REQUEST_DATE = "Awesome! When do you want to play? (Reply YYYY-MM-DD HH:MM, e.g., 2023-11-25 18:00)"
MSG_INVALID_DATE_FORMAT = "Invalid format. Please use YYYY-MM-DD HH:MM (e.g., 2023-11-25 18:00)."
MSG_RANGE_TOO_SHORT = "Range too short for a 120-min match."
MSG_PLAYER_NOT_FOUND = "Error: Player profile not found."
MSG_MATCH_REQUESTED_VOTING = "Voting match created! We found {count} players to invite to vote on times."
MSG_MATCH_REQUESTED_CONFIRMED = "Match requested for {time} (2 hours)! We found {count} players to invite. We'll let you know when they join."
MSG_MATCH_CREATION_ERROR = "Something went wrong creating your match request."
MSG_MATCH_FULL = "Sorry, this match just filled up! We'll let you know about the next one."
MSG_MATCH_ALREADY_FULL = "Sorry, this match is already full or cancelled."
MSG_YOU_ARE_IN = "You're in! We'll confirm once we have 4 players."

MSG_UPDATE_JOINED = "Update: {name} just joined! {spots} spots left. Reply YES to grab a spot."
MSG_MATCH_CONFIRMED = "MATCH CONFIRMED! {time}. See you on the court!"

MSG_DECLINE = "No problem! We'll ask you next time."
MSG_MAYBE = "Got it, we'll keep you updated as this match comes together and follow up with you if we still need players."

MSG_INVALID_RANGE_FORMAT = "Invalid range format. Use YYYY-MM-DD HH:MM-HH:MM (e.g., 2023-12-01 14:00-18:00)."
MSG_MATCH_TRIGGER_FAIL = "Match requested, but we couldn't trigger invites right now."

# States
STATE_NEW = "NEW"
STATE_WAITING_NAME = "WAITING_NAME"
STATE_WAITING_LEVEL = "WAITING_LEVEL"
STATE_WAITING_AVAILABILITY = "WAITING_AVAILABILITY"
STATE_MATCH_REQUEST_DATE = "MATCH_REQUEST_DATE"
STATE_MATCH_REQUEST_DURATION = "MATCH_REQUEST_DURATION"
STATE_COMPLETED = "COMPLETED"


