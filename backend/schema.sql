-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clubs (No dependencies)
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

-- Courts (Depends on clubs)
CREATE TABLE courts (
    court_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(club_id),
    name TEXT NOT NULL,
    settings JSONB
);

-- Players (Depends on clubs)
CREATE TABLE players (
  player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL, -- same phone can be at multiple clubs
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
  total_matches_played INTEGER DEFAULT 0,
  -- Unique constraint allows same phone at multiple clubs
  UNIQUE (phone_number, club_id)
);

-- Matches (Depends on clubs, courts)
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
  status TEXT CHECK (status IN ('pending', 'voting', 'confirmed', 'completed', 'cancelled')),
  voting_options JSONB, -- List of timestamps for voting
  voting_deadline TIMESTAMP
);

-- Feedback (Depends on matches, players)
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

-- Player Compatibility (Depends on players)
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

-- Private Groups (Depends on clubs, players)
CREATE TABLE private_groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  group_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES players(player_id),
  member_ids UUID[] CHECK (array_length(member_ids, 1) BETWEEN 8 AND 10),
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Match Invites (Depends on matches, players)
CREATE TABLE match_invites (
  invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  status TEXT CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'maybe', 'removed')),
  sent_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP
);

-- Match Votes (Depends on matches, players)
CREATE TABLE match_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  selected_option TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
