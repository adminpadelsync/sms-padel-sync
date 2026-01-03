-- SMS Padel Sync - Database Schema
-- Last Updated: December 19, 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
  club_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  court_count INTEGER NOT NULL CHECK (court_count BETWEEN 4 AND 12),
  phone_number TEXT UNIQUE NOT NULL, -- dedicated SMS number
  playbypoint_credentials JSONB,
  playtomic_credentials JSONB,
  settings JSONB, -- quiet_hours, business_hours, feedback_delay_hours, invite_batch_size, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

COMMENT ON COLUMN clubs.settings IS 'Club settings including: quiet_hours, business_hours, feedback_delay_hours, invite_batch_size (default 6)';

-- Courts
CREATE TABLE IF NOT EXISTS courts (
    court_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(club_id),
    name TEXT NOT NULL,
    settings JSONB
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  
  -- Skill levels (0.25 increments: 2.50, 2.75, 3.00, ... 5.00)
  declared_skill_level DECIMAL(3,2) CHECK (declared_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00)),
  adjusted_skill_level DECIMAL(3,2) CHECK (adjusted_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00)),
  level_confidence_score INTEGER CHECK (level_confidence_score BETWEEN 0 AND 100),
  last_level_adjustment_date TIMESTAMP WITH TIME ZONE,
  last_level_adjustment_by UUID,
  last_level_adjustment_reason TEXT,
  
  -- Pro verification
  pro_verified BOOLEAN DEFAULT false,
  pro_verified_at TIMESTAMP WITH TIME ZONE,
  pro_verified_by UUID,
  pro_verification_notes TEXT,
  
  -- Cached scoring
  responsiveness_score INTEGER DEFAULT 50 CHECK (responsiveness_score BETWEEN 0 AND 100),
  reputation_score INTEGER DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100),
  total_invites_received INTEGER DEFAULT 0,
  total_invites_accepted INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  average_response_time_seconds INTEGER,
  
  -- Status
  active_status BOOLEAN DEFAULT true,
  muted_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE,
  total_matches_played INTEGER DEFAULT 0,
  
  -- Elo / Sync Ranking
  elo_rating INTEGER DEFAULT 1500,
  elo_confidence INTEGER DEFAULT 0,
  
  -- Availability (Simplified flags or JSON)
  avail_weekday_morning BOOLEAN DEFAULT false,
  avail_weekday_afternoon BOOLEAN DEFAULT false,
  avail_weekday_evening BOOLEAN DEFAULT false,
  avail_weekend_morning BOOLEAN DEFAULT false,
  avail_weekend_afternoon BOOLEAN DEFAULT false,
  avail_weekend_evening BOOLEAN DEFAULT false
);

-- Club Memberships
CREATE TABLE IF NOT EXISTS club_members (
  club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (club_id, player_id)
);

-- Player Groups
CREATE TABLE IF NOT EXISTS player_groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Memberships
CREATE TABLE IF NOT EXISTS group_memberships (
  group_id UUID NOT NULL REFERENCES player_groups(group_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, player_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  court_id UUID REFERENCES courts(court_id),
  booking_id TEXT, -- external booking system ID
  team_1_players UUID[2] NOT NULL,
  team_2_players UUID[2] NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  no_show_players UUID[],
  feedback_collected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'voting', 'confirmed', 'completed', 'cancelled')),
  voting_options JSONB,
  voting_deadline TIMESTAMP WITH TIME ZONE,
  court_booked BOOLEAN DEFAULT false,
  originator_id UUID REFERENCES players(player_id),
  booked_at TIMESTAMP WITH TIME ZONE,
  booked_by UUID REFERENCES users(user_id),
  
  -- Result Information
  score_text TEXT,
  winner_team INTEGER CHECK (winner_team IN (1, 2)),
  teams_verified BOOLEAN DEFAULT false
);

-- Match Invites
CREATE TABLE IF NOT EXISTS match_invites (
  invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  status TEXT CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'maybe', 'removed')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- ML tracking fields
  invite_score INTEGER CHECK (invite_score BETWEEN 0 AND 100),
  score_breakdown JSONB,
  response_time_seconds INTEGER
);

-- Feedback
CREATE TABLE IF NOT EXISTS match_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  would_play_with_group_again BOOLEAN,
  individual_ratings JSONB, -- {player_id: boolean}
  level_accuracy_feedback JSONB, -- {player_id: "too_low"|"just_right"|"too_high"}
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  nps_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Compatibility
CREATE TABLE IF NOT EXISTS player_compatibility (
  player_1_id UUID NOT NULL REFERENCES players(player_id),
  player_2_id UUID NOT NULL REFERENCES players(player_id),
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  would_play_again_count INTEGER DEFAULT 0,
  would_not_play_again_count INTEGER DEFAULT 0,
  last_match_together TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_1_id, player_2_id)
);

-- Error Logs
CREATE TABLE IF NOT EXISTS error_logs (
    error_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone_number VARCHAR(20),
    player_id UUID REFERENCES players(player_id),
    club_id UUID REFERENCES clubs(club_id),
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    sms_body TEXT,
    handler_name VARCHAR(100),
    additional_context JSONB
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_phone ON error_logs(phone_number);

-- Reasoner Test Cases
CREATE TABLE IF NOT EXISTS reasoner_test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  initial_state TEXT DEFAULT 'IDLE',
  steps JSONB NOT NULL, -- List of {user_input, expected_intent, expected_entities}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE reasoner_test_cases IS 'Stores "Golden" conversational scenarios used for regression testing the AI Reasoner.';

-- SMS Outbox (for test mode)
CREATE TABLE IF NOT EXISTS sms_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    to_number TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessment Results
CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name TEXT,
    responses JSONB NOT NULL,
    rating DECIMAL(3,2) NOT NULL,
    breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Rating History
CREATE TABLE IF NOT EXISTS player_rating_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  old_elo_rating INTEGER,
  new_elo_rating INTEGER NOT NULL,
  old_sync_rating DECIMAL(3,2),
  new_sync_rating DECIMAL(3,2) NOT NULL,
  change_type TEXT NOT NULL, -- 'match_result', 'pro_verification', 'assessment', 'manual_adjustment'
  match_id UUID REFERENCES matches(match_id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_history_player ON player_rating_history(player_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_created_at ON player_rating_history(created_at DESC);

COMMENT ON TABLE player_rating_history IS 'Stores the timeline of Elo and Sync rating changes for each player.';
