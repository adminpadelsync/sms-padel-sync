import os

base_dir = "/Users/adamrogers/Documents/sms-padel-sync"
output_path = os.path.join(base_dir, "consolidated_test_schema.sql")

with open(output_path, "w") as out:
    out.write("-- COMPREHENSIVE FINAL STATE CONSOLIDATED SCHEMA (VERSION 6) --\n")
    out.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n\n")
    
    out.write("-- Clean slate --\n")
    out.write("""
DROP TABLE IF EXISTS player_rating_history CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;
DROP TABLE IF EXISTS user_clubs CASCADE;
DROP TABLE IF EXISTS match_votes CASCADE;
DROP TABLE IF EXISTS feedback_requests CASCADE;
DROP TABLE IF EXISTS match_invites CASCADE;
DROP TABLE IF EXISTS match_participations CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS player_groups CASCADE;
DROP TABLE IF EXISTS group_memberships CASCADE;
DROP TABLE IF EXISTS club_members CASCADE;
DROP TABLE IF EXISTS courts CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;
DROP TABLE IF EXISTS sms_outbox CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS reasoner_test_cases CASCADE;
DROP TABLE IF EXISTS assessment_results CASCADE;
""")

    out.write("\n-- 1. Clubs --\n")
    out.write("""
CREATE TABLE clubs (
  club_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  court_count INTEGER NOT NULL DEFAULT 4,
  playbypoint_credentials JSONB,
  playtomic_credentials JSONB,
  settings JSONB,
  address TEXT,
  poc_name TEXT,
  poc_phone TEXT,
  main_phone TEXT,
  booking_system TEXT,
  booking_slug TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  twilio_sid TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);\n""")

    out.write("\n-- 2. Users --\n")
    out.write("""
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'club_admin',
  is_superuser BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  club_id UUID REFERENCES clubs(club_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);\n""")

    out.write("\n-- 3. Players --\n")
    out.write("""
CREATE TABLE players (
  player_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  declared_skill_level DECIMAL(3,2),
  adjusted_skill_level DECIMAL(3,2),
  level_confidence_score INTEGER,
  last_level_adjustment_date TIMESTAMP WITH TIME ZONE,
  last_level_adjustment_by UUID,
  last_level_adjustment_reason TEXT,
  pro_verified BOOLEAN DEFAULT false,
  pro_verified_at TIMESTAMP WITH TIME ZONE,
  pro_verified_by UUID,
  pro_verification_notes TEXT,
  responsiveness_score INTEGER DEFAULT 50,
  reputation_score INTEGER DEFAULT 50,
  total_invites_received INTEGER DEFAULT 0,
  total_invites_accepted INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  average_response_time_seconds INTEGER,
  active_status BOOLEAN DEFAULT true,
  muted_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE,
  total_matches_played INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1500,
  elo_confidence INTEGER DEFAULT 0,
  avail_weekday_morning BOOLEAN DEFAULT false,
  avail_weekday_afternoon BOOLEAN DEFAULT false,
  avail_weekday_evening BOOLEAN DEFAULT false,
  avail_weekend_morning BOOLEAN DEFAULT false,
  avail_weekend_afternoon BOOLEAN DEFAULT false,
  avail_weekend_evening BOOLEAN DEFAULT false,
  private_groups UUID[],
  blocked_players UUID[]
);\n""")

    out.write("\n-- 4. Courts --\n")
    out.write("""
CREATE TABLE courts (
    court_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(club_id),
    name TEXT NOT NULL,
    settings JSONB
);\n""")

    out.write("\n-- 5. Groups --\n")
    out.write("""
CREATE TABLE player_groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'private',
  phone_number TEXT,
  twilio_sid TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);\n""")

    out.write("\n-- 6. Matches & Logic --\n")
    out.write("""
CREATE TABLE matches (
  match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  court_id UUID REFERENCES courts(court_id),
  booking_id TEXT,
  originator_id UUID REFERENCES players(player_id),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  no_show_players UUID[],
  feedback_collected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT,
  voting_options JSONB,
  voting_deadline TIMESTAMP WITH TIME ZONE,
  court_booked BOOLEAN DEFAULT false,
  booked_at TIMESTAMP WITH TIME ZONE,
  booked_by UUID REFERENCES users(user_id),
  score_text TEXT,
  winner_team INTEGER,
  teams_verified BOOLEAN DEFAULT false,
  booked_court_text TEXT,
  gender_preference TEXT,
  level_range_min FLOAT,
  level_range_max FLOAT,
  target_group_id UUID REFERENCES player_groups(group_id),
  result_nudge_count INTEGER DEFAULT 0,
  last_result_nudge_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE match_participations (
    match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    team_index INTEGER NOT NULL CHECK (team_index IN (1, 2)),
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE match_invites (
  invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id),
  player_id UUID NOT NULL REFERENCES players(player_id),
  status TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  batch_number INTEGER DEFAULT 1,
  invite_score INTEGER,
  score_breakdown JSONB,
  response_time_seconds INTEGER
);

CREATE TABLE feedback_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(match_id),
    player_id UUID NOT NULL REFERENCES players(player_id),
    initial_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

CREATE TABLE match_votes (
    vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(match_id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(player_id) ON DELETE CASCADE,
    selected_option TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
""")

    out.write("\n-- 7. Analytics & History --\n")
    out.write("""
CREATE TABLE player_rating_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  old_elo_rating INTEGER,
  new_elo_rating INTEGER NOT NULL,
  old_sync_rating DECIMAL(3,2),
  new_sync_rating DECIMAL(3,2) NOT NULL,
  change_type TEXT NOT NULL,
  match_id UUID REFERENCES matches(match_id),
  assessment_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE error_logs (
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

CREATE TABLE reasoner_test_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  initial_state TEXT DEFAULT 'IDLE',
  steps JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sms_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    to_number TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name TEXT,
    responses JSONB NOT NULL,
    rating DECIMAL(3,2) NOT NULL,
    breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
""")

    out.write("\n-- 8. Multi-Tenant Infrastructure --\n")
    out.write("""
CREATE TABLE club_members (
  club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (club_id, player_id)
);

CREATE TABLE group_memberships (
  group_id UUID NOT NULL REFERENCES player_groups(group_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, player_id)
);

CREATE TABLE user_clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, club_id)
);
""")

    out.write("\n-- 9. Security (RLS) --\n")
    out.write("""
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clubs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public access for testing') THEN
        CREATE POLICY \"Public access for testing\" ON clubs FOR ALL USING (true);
        CREATE POLICY \"Public access for testing\" ON players FOR ALL USING (true);
        CREATE POLICY \"Public access for testing\" ON matches FOR ALL USING (true);
        CREATE POLICY \"Public access for testing\" ON user_clubs FOR ALL USING (true);
    END IF;
END $$;
""")

print(f"Successfully created {output_path}")
