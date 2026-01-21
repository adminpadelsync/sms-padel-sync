# Matchmaking & Invitation Logic

This document details how the system identifies players and sends invitations, and how it handles invite expirations.

## Identity & Context Resolution
To maintain high reliability, the system does not perform strict string equality for phone numbers.

1.  **Normalization**: All numbers are stripped of whitespace and formatting (e.g., `(555) 123-4567` becomes `5551234567`).
2.  **Last-10 Matching**: The backend extracts the last 10 digits of the normalized string and searches the `players`, `clubs`, and `player_groups` tables using a fuzzy `ilike` match. This prevents "Identity Fragmentation" when numbers are stored with varying international prefixes or bracket formats.
3.  **Ambiguity Fallback**: If a club cannot be resolved by the "To" number (common during simulator tests or new club setup), the system falls back to the first available club in the persistent database to ensure the user receives a response.

## Invitation Flows

There are two primary modes for initiating a match: **Everyone (Default)** and **Targeted Group**.

| Feature | **"Everyone" (Default)** | **"Group" (Targeted)** |
| :--- | :--- | :--- |
| **Logic Source** | `match_handler.py` -> `find_and_invite_players` | `match_handler.py` -> `find_and_invite_players` |
| **Target Audience** | All active club members. | Members of the selected `target_group_id`. |
| **Filtering** | **Skill Level (±0.25)** and **Gender match**. | **Bypassed.** (All group members are eligible). |
| **Initial Invites** | **Batch of 6** (Top ranked candidates). | **EVERYONE** in the group. |
| **Ranking** | Ranked by scoring engine (Skill, Distance, Activity). | All group members invited simultaneously. |
| **Trigger** | Player confirms preferences or selects "Everyone". | Player selects a specific group number. |

---

## Invite Expiration & Refilling

Invites are time-limited. The duration is configurable at the **Club Level** via `invite_timeout_minutes` (defaulting to 15).

### Expiration Process (`process_expired_invites`)
A cron job runs every 5 minutes and performs the following:
1.  Identifies `match_invites` with `status="sent"` where `expires_at` is in the past (UTC).
2.  Marks these records as `status="expired"`.
3.  Clears the player's conversation state in Redis (allowing them to receive new invites).
4.  **Refills the match**: Calls `find_and_invite_players` to replace the expired slots.

### Refill Behavior
- **"Everyone" Match**: The system identifies the next best candidates in the candidate pool (excluding anyone already invited or in the match) and sends invitations to replace the expired ones.
- **"Group" Match**: The system attempts to find other members of the group. However, since **all** members were invited initially, there are typically no new candidates left to invite. The match capacity remains lower until more players from the initial blast respond.

---

## Response Handling

### "YES" (Accept)
- Player is added to the match record.
- If the match becomes full (4 players), the match status changes to `confirmed` and a final SMS is sent to all participants.

### "NO" (Decline)
- Invite status is marked as `declined`.
- **Immediate Refill**: `invite_replacement_player` is called to invite **one** new candidate immediately to take their place.
- Similar to expiration, this works well for "Everyone" matches but finds no one for "Group" matches where everyone was already invited.

### "MUTE"
- Player is muted until midnight.
- They will not receive any more proactive invites for any match until tomorrow.

---

## Simulator Testing Mode
When testing via the Admin Simulator, the system enables an explicit **`force_test_mode`** context.

- **Outbox Trapping**: All outgoing SMS responses generated during the simulator session are intercepted and stored in the `sms_outbox` table instead of being sent to Twilio.
- **Frontend Polling**: The Simulator UI polls the `/api/sms-outbox` endpoint every few seconds to retrieve and display these "trapped" messages in the chat window.
- **Safety**: This ensures that testing on real player profiles (like Mike Johnson) never results in accidental messages being sent to their actual phones during development.
