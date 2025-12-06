# Twilio A2P Campaign Registration Answers

## Campaign Information

### Campaign Use Case
**Select:** Customer Care (or Mixed)

### Messaging Service
**Select:** Create new Messaging Service
- ✅ Automatically add Compliant numbers

### Campaign Description
```
Padel Sync (formerly Padel Match Maker) - Padel court matchmaking service... Players receive match invitations, confirm availability, vote on times, and get notifications about upcoming games. All messages are transactional and initiated based on user opt-in at club registration. Users can opt-out at any time. Message frequency varies based on match availability.
```

---

## Sample Messages

### Sample Message #1
```
🎾 Match invite! Play tomorrow (Nov 27) at 3:00 PM? Reply YES or NO. Msg & data rates may apply.
```

### Sample Message #2
```
✅ Match confirmed! Tomorrow 3pm with John (4.0), Sarah (3.5), Mike (4.0). Court 2. Reply STATUS for details. Msg & data rates may apply.
```

### Sample Message #3
```
📊 Confirmed players (3/4): Adam Rogers (4.0), Jeff Miller (3.5), Sarah Chen (3.5). Waiting for 1 more! Reply HELP for help.
```

### Sample Message #4 (Help Response)
```
Padel Sync: Commands: YES/NO (respond to invites), STATUS (check match), MATCHES (upcoming games), HELP. Reply STOP to opt out. Msg&data rates may apply.
```

---

## Message Contents

**Check the following:**
- ✅ Messages will include embedded links
- ⬜ Messages will include phone numbers
- ⬜ Messages include content related to direct lending or other loan arrangement
- ⬜ Messages include age-gated content (only if your club is 18+ or 21+ restricted)

### Proof of consent (opt-in) collected
**URL:** `https://padelsync.com`

### Opt-In Description
```
Users opt-in verbally when registering at their padel club front desk, or by visiting our website https://padelsync.com and texting the advertised number.

The strict verbal script used by agents is: 
"Would you like to receive text messages about match invites and game updates from Padel Sync? Message and data rates may apply. Message frequency varies. You can reply STOP to unsubscribe at any time."

If the user agrees, the admin adds their phone number to the system. 

Additionally, players can visit https://padelsync.com and see the instruction:
"Text START to [Number] to join Padel Sync alerts. Msg & data rates may apply. Msg freq varies. Reply STOP to cancel."

The strict verbal script used by agents is: 
"Would you like to receive text messages about match invites and game updates from Padel Sync? Message and data rates may apply. Message frequency varies. You can reply STOP to unsubscribe at any time."

If the user agrees, the admin adds their phone number to the system. Additionally, players can text START to our number which is advertised on signage at the club front desk. The signage explicitly states: "Text START to join Padel Sync alerts. Msg & data rates may apply. Msg freq varies. Reply STOP to cancel."
```

### Opt-In Keywords
```
START, PLAY, REGISTER, JOIN
```

### Opt-Out Keywords (Required)
```
STOP, UNSUBSCRIBE, CANCEL, END, QUIT
```

### Help Keywords
```
HELP, INFO, COMMANDS
```

---

## Compliance Messages

### Opt-In Confirmation Message
```
Welcome to Padel Sync! You'll receive match invites and updates. Message frequency varies. Msg&data rates may apply. Reply HELP for help, STOP to cancel.
```

### Help Message
```
Padel Sync: Commands: YES/NO (respond to invites), STATUS (check match), MATCHES (upcoming games). Reply STOP to unsubscribe. Msg&data rates may apply.
```

### Stop Message (Auto-sent by Twilio)
```
You have successfully been unsubscribed from Padel Sync. You will not receive any more messages. Reply START to resubscribe.
```

---

## Additional Notes

- **Message Volume:** Estimate 10-50 messages per day initially
- **Business Type:** Sports & Recreation / Club Services
- **Target Audience:** Adult club members (18+)
- **Geographic Focus:** United States (expand as needed)
