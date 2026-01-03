# Matchmaking & Invitation Logic

This document details how the system identifies players and sends invitations, and how it handles invite expirations.

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
