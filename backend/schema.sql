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
  gender TEXT CHECK (gender IN ('male', 'female')),
  
  -- Skill levels (0.25 increments: 2.50, 2.75, 3.00, ... 5.00)
  declared_skill_level DECIMAL(3,2) CHECK (declared_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00)),
  adjusted_skill_level DECIMAL(3,2) CHECK (adjusted_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00)),
  level_confidence_score INTEGER CHECK (level_confidence_score BETWEEN 0 AND 100),
  last_level_adjustment_date TIMESTAMP,
  last_level_adjustment_by UUID,
  last_level_adjustment_reason TEXT,
  
  -- Pro verification
  pro_verified BOOLEAN DEFAULT false,
  pro_verified_at TIMESTAMP,
  pro_verified_by UUID,
  pro_verification_notes TEXT,
  
  -- Cached scoring (updated nightly)
  responsiveness_score INTEGER DEFAULT 50 CHECK (responsiveness_score BETWEEN 0 AND 100),
  reputation_score INTEGER DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100),
  total_invites_received INTEGER DEFAULT 0,
  total_invites_accepted INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  average_response_time_seconds INTEGER,
  
  -- Club and status
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  active_status BOOLEAN DEFAULT true,
  blocked_players UUID[],
  private_groups UUID[],
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  total_matches_played INTEGER DEFAULT 0,
  
  -- Availability preferences (legacy, to be replaced in Phase 1.5)
  availability_preferences JSONB,
  
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
  responded_at TIMESTAMP,
  
  -- ML tracking fields
  invite_score INTEGER CHECK (invite_score BETWEEN 0 AND 100),
  score_breakdown JSONB, -- {"responsiveness": 75, "compatibility": 82, "reputation": 68}
  response_time_seconds INTEGER
);

-- Match Votes (Depends on matches, players)
CREATE TABLE match_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  selected_option TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
