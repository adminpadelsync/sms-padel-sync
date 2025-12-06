-- Multi-Tenancy Migration: Users Table and RLS Policies
-- Run this in Supabase SQL Editor

-- 1. Create users table to associate auth users with clubs
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES clubs(club_id),
  role TEXT NOT NULL CHECK (role IN ('superuser', 'club_admin', 'club_staff')),
  is_superuser BOOLEAN DEFAULT false,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX idx_users_club_id ON users(club_id);
CREATE INDEX idx_users_email ON users(email);

-- 2. Enable Row Level Security on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for users table
CREATE POLICY "Users can view their own record"
  ON users FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true
  ));

CREATE POLICY "Superusers can manage all users"
  ON users FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true
  ));

-- 4. RLS Policies for clubs
CREATE POLICY "Users can view their own club"
  ON clubs FOR SELECT
  USING (
    -- Superusers see all clubs
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    -- Regular users see their club
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Superusers can manage clubs"
  ON clubs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true
  ));

-- 5. RLS Policies for players
CREATE POLICY "Users can view players from their club"
  ON players FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can manage their club's players"
  ON players FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can update their club's players"
  ON players FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can delete their club's players"
  ON players FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

-- 6. RLS Policies for matches
CREATE POLICY "Users can view matches from their club"
  ON matches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can manage their club's matches"
  ON matches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

-- 7. RLS Policies for courts
CREATE POLICY "Users can view courts from their club"
  ON courts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can manage their club's courts"
  ON courts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

-- 8. RLS Policies for private_groups
CREATE POLICY "Users can view private groups from their club"
  ON private_groups FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

CREATE POLICY "Club admins can manage their club's private groups"
  ON private_groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  );

-- 9. RLS Policies for match_feedback (via player's club)
CREATE POLICY "Users can view feedback from their club's matches"
  ON match_feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.player_id = match_feedback.player_id
      AND p.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Club admins can manage feedback from their club"
  ON match_feedback FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.player_id = match_feedback.player_id
      AND p.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

-- 10. RLS Policies for player_compatibility (via player's club)
CREATE POLICY "Users can view compatibility from their club"
  ON player_compatibility FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.player_id = player_compatibility.player_1_id
      AND p.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Club admins can manage compatibility from their club"
  ON player_compatibility FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.player_id = player_compatibility.player_1_id
      AND p.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

-- 11. RLS Policies for match_invites (via match's club)
CREATE POLICY "Users can view invites from their club"
  ON match_invites FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = match_invites.match_id
      AND m.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Club admins can manage invites from their club"
  ON match_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = match_invites.match_id
      AND m.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

-- 12. RLS Policies for match_votes (via match's club)
CREATE POLICY "Users can view votes from their club"
  ON match_votes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = match_votes.match_id
      AND m.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Club admins can manage votes from their club"
  ON match_votes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = match_votes.match_id
      AND m.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
    )
  );

-- Success message
SELECT 'Multi-tenancy migration completed successfully!' as message;
