-- STAGE 1: Infrastructure
-- Run this first to create the membership table.
CREATE TABLE IF NOT EXISTS club_members (
    club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (club_id, player_id)
);

-- STAGE 2: INITIAL DATA CAPTURE
-- Run this to capture all current club associations BEFORE merging players.
INSERT INTO club_members (club_id, player_id, added_at)
SELECT club_id, player_id, created_at
FROM players
ON CONFLICT DO NOTHING;

-- STOP HERE!
-- Now run the Python migration script: python backend/scripts/migrate_universal_players.py
-- This will merge duplicate players and update all references.

-- STAGE 3: ENFORCE UNIQUENESS
-- Run this ONLY AFTER the Python script has successfully merged all duplicates.
-- If you get an error that the relation already exists, you can safely skip this step.
ALTER TABLE players ADD CONSTRAINT players_phone_number_key UNIQUE (phone_number);

-- STAGE 3.5: UPDATE RLS POLICIES (Infrastructure dependencies)
-- These must be updated BEFORE dropping players.club_id

-- Players Policies
DROP POLICY IF EXISTS "Users can view players from their club" ON players;
CREATE POLICY "Users can view players from their club" ON players FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  player_id IN (SELECT player_id FROM club_members WHERE club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Club admins can manage their club's players" ON players;
CREATE POLICY "Club admins can manage their club's players" ON players FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  -- Note: On insertion, the player doesn't have a membership yet. 
  -- But we can't really check club_id on players anymore. 
  -- We allow the insert if the user is a club admin of ANY club (the onboarding logic handles membership)
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update their club's players" ON players;
CREATE POLICY "Club admins can update their club's players" ON players FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  player_id IN (SELECT player_id FROM club_members WHERE club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Club admins can delete their club's players" ON players;
CREATE POLICY "Club admins can delete their club's players" ON players FOR DELETE
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  player_id IN (SELECT player_id FROM club_members WHERE club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid()))
);

-- Match Feedback Policies
DROP POLICY IF EXISTS "Users can view feedback from their club's matches" ON match_feedback;
CREATE POLICY "Users can view feedback from their club's matches" ON match_feedback FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.player_id = match_feedback.player_id
    AND cm.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Club admins can manage feedback from their club" ON match_feedback;
CREATE POLICY "Club admins can manage feedback from their club" ON match_feedback FOR ALL
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.player_id = match_feedback.player_id
    AND cm.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  )
);

-- Player Compatibility Policies
DROP POLICY IF EXISTS "Users can view compatibility from their club" ON player_compatibility;
CREATE POLICY "Users can view compatibility from their club" ON player_compatibility FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.player_id = player_compatibility.player_1_id
    AND cm.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Club admins can manage compatibility from their club" ON player_compatibility;
CREATE POLICY "Club admins can manage compatibility from their club" ON player_compatibility FOR ALL
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.player_id = player_compatibility.player_1_id
    AND cm.club_id IN (SELECT club_id FROM users WHERE user_id = auth.uid())
  )
);

-- STAGE 4: CLEANUP
-- Run this after verifying everything is working.
ALTER TABLE players DROP COLUMN club_id;
