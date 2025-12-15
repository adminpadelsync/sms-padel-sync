# Recommendation Engine

> **Purpose**: Maximize court utilization by intelligently matching players who will enjoy playing together and keep coming back.

## Overview

The recommendation engine scores players when sending match invites, ranking them by likelihood of:
1. Accepting the invite
2. Having a great match experience
3. Returning for future matches

---

## Three-Dimensional Scoring Model

### 1. Responsiveness Score (0-100)
*"Will this player actually respond and show up?"*

| Signal | Weight | Description |
|--------|--------|-------------|
| Accept Rate | 35% | `accepted / total_invites_received` |
| Response Speed | 25% | Normalized time from `sent_at` to `responded_at` |
| Reliability | 20% | `1 - no_show_rate` |
| Engagement | 10% | Frequency of initiating match requests |
| Feedback Participation | 5% | Response rate to post-match feedback |
| Pro Verified | 5% | Bonus for players with validated skill level |

### 2. Match Compatibility Score (0-100)
*"How well does this player fit THIS specific match?"*

| Signal | Weight | Description |
|--------|--------|-------------|
| Skill Level Delta | 40% | Distance from target level (±0.50 tolerance) |
| Gender Preference | 25% | Match preference: same=100%, mixed=50%, opposite=0% |
| Historical Compatibility | 20% | From `player_compatibility` table |
| Availability Alignment | 10% | Structured: 6 time buckets (weekday/weekend × morning/afternoon/evening) |
| Freshness Factor | 5% | Decay if played together recently (encourages variety) |

**Freshness Multiplier:**
- `>14 days` since last match together → 1.0×
- `7-14 days` → 0.9×
- `3-7 days` → 0.8×
- `<3 days` → 0.6×

### 3. Reputation Score (0-100)
*"What do other players think of this person?"*

| Signal | Weight | Description |
|--------|--------|-------------|
| Average Feedback Rating | 50% | From `match_feedback.individual_ratings` (1-10 scale) |
| Would Play Again % | 30% | From `player_compatibility` aggregate |
| NPS Score Average | 10% | From `match_feedback.nps_score` |
| Level Accuracy Consensus | 10% | Penalty if others report level as inflated |

---

## Composite Invite Score

```
invite_score = (
    0.40 × match_compatibility +
    0.35 × responsiveness +
    0.25 × reputation
)
```

Players are ranked by `invite_score DESC` and invited in batches.

---

## Skill Level System

### Granularity
- **Range**: 2.50 to 5.00
- **Increment**: 0.25 (11 total levels)
- **Tolerance**: ±0.50 for matching

### Level Types
| Field | Purpose |
|-------|---------|
| `declared_skill_level` | Player's self-reported level during onboarding |
| `adjusted_skill_level` | System-calculated level based on feedback |
| `pro_verified` | Boolean flag indicating level has been validated by club staff |

### Pro Verification
- Clubs should verify all players' skill levels
- Dashboard shows verification progress (e.g., "62% verified")
- Verification records who validated and when

---

## Special Cases

### Group Invites
When a match targets a private group (`skip_filters=True`):
- All group members invited regardless of level/gender
- Responsiveness and reputation scores still apply for ordering

### Urgency Boost
For matches <4 hours away with <4 confirmed players:
- High-responsiveness players get priority
- May expand level tolerance to ±0.75

### New Players
Players with no history receive neutral scores:
- Responsiveness: 50 (pending data)
- Reputation: 50 (pending data)
- Not penalized, but unproven

---

## ML-Ready Data Collection

Every invite captures:
- `invite_score` at send time
- `actual_response` (accept/decline/expired)
- `match_completed` (did match happen?)
- `post_match_feedback` (was experience positive?)

This enables future supervised learning:
```
P(successful_match | player, context) → 0.0 to 1.0
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Invite Accept Rate | >40% |
| Match Completion Rate | >90% |
| Post-Match Feedback Avg | >7.0 |
| Court Utilization Increase | 5-25% |
