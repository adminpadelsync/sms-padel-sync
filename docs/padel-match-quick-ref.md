# Padel Engagement Platform - Quick Reference for Development

## Product Overview
SMS-based matchmaking service for padel clubs that automatically creates 4-player doubles matches, learns from feedback, and integrates with club booking systems.

**Core Value**: Increase court utilization 25%+ by removing friction in finding compatible matches.

## Tech Stack

### Backend
- **Language**: Python 3.11+ or TypeScript/Node.js
- **Framework**: FastAPI (Python) or Express.js (TypeScript)
- **Database**: Supabase (PostgreSQL with real-time, auth, RLS)
- **Cache**: Redis (sessions, rate limiting)
- **Queue**: Redis Queue (RQ) or BullMQ
- **SMS**: Twilio Programmable SMS

### Frontend (Admin Dashboard)
- **Framework**: Next.js 14+ (React 18)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **Charts**: Recharts

### Infrastructure
- **Hosting**: Vercel (frontend) + Railway/Render (backend)
- **Database**: Supabase (managed)
- **Monitoring**: Supabase + Sentry
- **CI/CD**: GitHub Actions

## Core Data Models

```sql
-- Players
CREATE TABLE players (
  player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT UNIQUE NOT NULL, -- encrypted
  name TEXT NOT NULL,
  declared_skill_level DECIMAL(2,1) CHECK (declared_skill_level IN (2.5, 3.0, 3.5, 4.0, 4.5, 5.0)),
  adjusted_skill_level DECIMAL(2,1) CHECK (adjusted_skill_level IN (2.5, 3.0, 3.5, 4.0, 4.5, 5.0)),
  level_confidence_score INTEGER CHECK (level_confidence_score BETWEEN 0 AND 100),
  last_level_adjustment_date TIMESTAMP,
  last_level_adjustment_by UUID, -- references users or 'system'
  last_level_adjustment_reason TEXT,
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  availability_preferences JSONB,
  active_status BOOLEAN DEFAULT true,
  blocked_players UUID[], -- array of player_ids
  private_groups UUID[], -- array of group_ids
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  total_matches_played INTEGER DEFAULT 0
);

-- Matches
CREATE TABLE matches (
  match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  court_id UUID REFERENCES courts(court_id),
  booking_id TEXT, -- external booking system ID
  team_1_players UUID[2] NOT NULL, -- exactly 2 player_ids
  team_2_players UUID[2] NOT NULL, -- exactly 2 player_ids
  scheduled_time TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP,
  no_show_players UUID[],
  feedback_collected BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'))
);

-- Feedback
CREATE TABLE match_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  would_play_with_group_again BOOLEAN,
  individual_ratings JSONB, -- {player_id: boolean} for each of 3 other players
  level_accuracy_feedback JSONB, -- {player_id: "too_low"|"just_right"|"too_high"}
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  nps_comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Player Compatibility
CREATE TABLE player_compatibility (
  player_1_id UUID NOT NULL REFERENCES players(player_id),
  player_2_id UUID NOT NULL REFERENCES players(player_id),
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  would_play_again_count INTEGER DEFAULT 0,
  would_not_play_again_count INTEGER DEFAULT 0,
  last_match_together TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_1_id, player_2_id)
);

-- Private Groups
CREATE TABLE private_groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  group_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES players(player_id),
  member_ids UUID[] CHECK (array_length(member_ids, 1) BETWEEN 8 AND 10),
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Clubs
CREATE TABLE clubs (
  club_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  court_count INTEGER NOT NULL CHECK (court_count BETWEEN 4 AND 12),
  phone_number TEXT UNIQUE NOT NULL, -- dedicated SMS number
  playbypoint_credentials JSONB,
  playtomic_credentials JSONB,
  settings JSONB, -- quiet_hours, business_hours, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);
```

## Critical Business Rules

### Matchmaking
1. **MUST be exactly 4 players** (doubles only)
2. Match players within **0.25 skill level range** (use adjusted_skill_level)
3. **Balance teams**: Team differential <0.5 total points (e.g., 3.5+3.5 vs 3.0+4.0)
4. **Never match blocked players** together
5. **Respect negative feedback**: If both players said "no", never match again
6. Prioritize players who **haven't played together in 14+ days**

### Player Leveling
1. **Dual tracking**: declared_skill_level (self-assessment) + adjusted_skill_level (system/pro adjusted)
2. **Club pro has final authority** on level adjustments
3. **Flag for review** if 3+ players rate someone wrong level in last 10 matches
4. **Confidence score** based on: matches played, pro verification, peer feedback consistency
5. **Leveling Health Score** = (Coverage * 0.5) + (Accuracy * 0.5), target: 80%

### Match Confirmation
1. Send confirmation **4 business hours before match** (Mon-Fri 9am-6pm)
2. If <4 confirmations after 2 hours: **find replacement**
3. If no replacement found: **cancel entire match**, release court
4. **No-show tracking**: 2 = warning, 3 in 30 days = 2-week suspension

### Feedback Collection (4 stages)
1. **Overall**: Would play with group again? YES/NO
2. **Individual**: Would play with each player again? YES/NO (3 questions)
3. **Level accuracy**: Each player's level too low/just right/too high (3 questions)
4. **NPS**: 0-10 likelihood to recommend

## Key Workflows

### Player Onboarding (SMS Flow)
```
System: "Welcome to [Club]! What's your name?"
Player: [Name]
System: "What's your skill level? (Reply A-G)
  A) 2.5 (Beginner)
  B) 3.0
  C) 3.5 (Intermediate)
  D) 4.0
  E) 4.5 (Advanced)
  F) 5.0+ (Pro)
  G) Not sure"
Player: [Letter]
System: "When do you usually like to play?"
Player: [Availability]
System: "You're all set! Text 'PLAY' when you want a game."
```

### Match Request (SMS Flow)
```
Player: "I want to play tomorrow at 6pm"
System: "Got it! Looking for 3 players at your level (3.5)..."
[System finds 3 compatible players]
System: (to other 3) "Want to play tomorrow 6pm with [P1], [P2], [P3]? 
  Skill: ~3.5. Reply YES or NO."
[Players respond]
System: (when 4 confirmed) "Match confirmed! Tomorrow 6pm, Court 3. 
  Teams: [P1+P2] vs [P3+P4]. Booking #12345."
```

### Matchmaking Algorithm (Pseudocode)
```python
def find_match(requesting_player, preferred_time, club_id):
    # 1. Get candidate players
    candidates = get_active_players(
        club_id=club_id,
        available_at=preferred_time,
        skill_range=(requesting_player.adjusted_level - 0.25, 
                     requesting_player.adjusted_level + 0.25),
        not_in=requesting_player.blocked_players
    )
    
    # 2. Filter by compatibility
    compatible = filter(
        lambda p: check_compatibility(requesting_player, p) and
                  not_blocked_by(p, requesting_player) and
                  days_since_last_match(requesting_player, p) >= 14
    , candidates)
    
    # 3. Generate all possible 4-player combinations
    combos = generate_combinations(requesting_player, compatible, size=4)
    
    # 4. Score each combo
    scored = []
    for combo in combos:
        teams = balance_teams(combo) # Split into 2 teams of 2
        score = calculate_match_score(
            skill_balance=abs(sum(teams[0].levels) - sum(teams[1].levels)),
            compatibility=avg_compatibility_score(combo),
            recency=avg_days_since_last_played_together(combo)
        )
        scored.append((combo, teams, score))
    
    # 5. Return top matches
    return sorted(scored, key=lambda x: x[2], reverse=True)[:3]

def balance_teams(players):
    # Create 2 teams where sum of levels are as close as possible
    # Target: Team differential <0.5
    pass
```

## API Integration Requirements

### PlayByPoint Integration
```javascript
// Check availability
GET /venues/{venue_id}/availability
  ?start_time=2025-01-15T18:00:00Z
  &duration_minutes=90

// Create booking
POST /bookings
{
  "venue_id": "string",
  "court_id": "string",
  "start_time": "2025-01-15T18:00:00Z",
  "duration_minutes": 90,
  "players": [
    {"member_id": "123", "name": "Player 1"},
    {"member_id": "124", "name": "Player 2"},
    {"member_id": "125", "name": "Player 3"},
    {"member_id": "126", "name": "Player 4"}
  ],
  "booking_type": "match"
}
```

### Playtomic Integration
```javascript
// Similar to PlayByPoint with different endpoint naming
GET /tenants/{tenant_id}/available-slots
POST /tenants/{tenant_id}/bookings
```

### Twilio SMS
```javascript
// Send SMS
POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
{
  "To": "+15551234567",
  "From": "+15559876543", // Club's dedicated number
  "Body": "Your match is confirmed! Tomorrow 6pm, Court 3..."
}

// Webhook for incoming SMS
POST /webhooks/sms/incoming
{
  "From": "+15551234567",
  "To": "+15559876543",
  "Body": "I want to play tomorrow at 6pm"
}
```

## Key Metrics to Track

### Product Metrics
- **MAU %**: Monthly Active Users / Total Members (target: 40%+)
- **NPS**: Net Promoter Score (target: 50+)
- **Time-to-match**: Hours from request to 4-player confirmation (target: <4 hours)
- **Leveling Health Score**: (Coverage + Accuracy) / 2 (target: 80%)
- **Match satisfaction**: "Would play again" positive rate (target: 75%+)

### Business Metrics
- **MRR**: Monthly Recurring Revenue
- **Churn rate**: % clubs cancelling (target: <5% monthly)
- **CAC**: Customer Acquisition Cost (target: <$2,000)
- **Utilization increase**: % improvement in court bookings (target: 25%+)

## MVP Features Priority

### P0 (Critical - Must Have)
1. SMS interface with basic commands
2. Player profile management (dual-level tracking)
3. Rule-based matchmaking (4-player, balanced teams)
4. PlayByPoint OR Playtomic integration
5. Match confirmation system (4 hours before)
6. Feedback collection (4-stage SMS flow)
7. Admin dashboard (overview, leveling, player management)

### P1 (Important - Should Have)
1. Proactive match creation
2. Private group management
3. No-show tracking and penalties
4. Player blocking functionality
5. Both PlayByPoint AND Playtomic integrations
6. Analytics dashboard with charts

### P2 (Nice to Have - Could Have)
1. Advanced NLP for SMS commands
2. Automated level adjustment suggestions
3. Match history export
4. Custom reporting
5. Multi-language SMS support

## Security Requirements

1. **Phone numbers**: Encrypt at rest (AES-256)
2. **Feedback**: Anonymous to other players
3. **RLS**: Supabase Row Level Security for multi-tenancy
4. **Auth**: OAuth 2.0 for admin dashboard, roles: Admin, Pro, Manager
5. **Compliance**: TCPA (SMS consent), GDPR (right to deletion)

## Development Phases

### Phase 1: MVP (Months 1-4)
- Core SMS flows + matchmaking + one integration
- Admin dashboard with leveling health focus
- 5 pilot clubs in South Florida

### Phase 2: Calendar Integration (Months 5-8)
- Google/Outlook calendar sync
- Smart scheduling based on free/busy times
- Recurring game suggestions

### Phase 3: Video & Leveling (Months 9-14)
- Court camera integration
- Automated highlights (30-90 sec)
- ML-based player leveling

### Phase 4: Leagues & Tournaments (Months 15-18)
- League management (seasons, standings)
- Tournament organization (brackets)
- Clinic coordination

## Common SMS Commands to Parse

```
Intent: Request Match
- "I want to play tomorrow at 6pm"
- "Play tonight"
- "Find me a game Friday evening"

Intent: Confirm/Decline
- "Yes" / "No" / "Maybe"

Intent: Update Profile
- "Update my level to 3.5"
- "My availability is weekday evenings"
- "Block [player name]"

Intent: Create Group
- "Create group [name]"
- "Add [player] to [group]"

Intent: Help
- "Help" / "Commands" / "?"
```

## Error Handling Patterns

```python
# Integration failures
try:
    booking = create_booking_playbypoint(match_details)
except APIError as e:
    log_error(e)
    send_sms(players, "Booking failed. Please book manually: [instructions]")
    alert_admin(club_id, "PlayByPoint integration error")

# SMS delivery failures
try:
    send_sms(player.phone, message)
except SMSError as e:
    queue_retry(player.phone, message, max_attempts=3)
    if attempts >= 3:
        alert_admin(club_id, f"Cannot reach player {player.name}")

# Matchmaking failures
candidates = find_match(player, time, club)
if len(candidates) == 0:
    send_sms(player.phone, 
             "Couldn't find a match this time. Want to try a different time?")
```

## Quick Setup Checklist

- [ ] Set up Supabase project (database, auth, realtime)
- [ ] Configure Twilio account (get phone numbers, set webhooks)
- [ ] Set up Redis instance (caching, queues)
- [ ] Create PlayByPoint/Playtomic sandbox accounts
- [ ] Set up GitHub repo with CI/CD
- [ ] Configure environment variables
- [ ] Set up monitoring (Sentry, Supabase logs)
- [ ] Create admin dashboard starter (Next.js + shadcn/ui)
- [ ] Implement SMS webhook endpoint
- [ ] Build player onboarding flow
- [ ] Build matchmaking algorithm
- [ ] Integrate booking APIs
- [ ] Build feedback collection system
- [ ] Create admin dashboard views

## Environment Variables Template

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

# Redis
REDIS_URL=redis://localhost:6379

# PlayByPoint
PLAYBYPOINT_API_KEY=xxx
PLAYBYPOINT_BASE_URL=https://api.playbypoint.com

# Playtomic
PLAYTOMIC_API_KEY=xxx
PLAYTOMIC_BASE_URL=https://api.playtomic.io

# App
NODE_ENV=development
API_BASE_URL=http://localhost:3000
WEBHOOK_SECRET=xxx
```

---

**This is your quick reference. For full context, see the complete PRD.**
