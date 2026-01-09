-- Migration: Update Legacy RLS Policies to use user_clubs
-- Date: 2026-01-08

-- This migration fixes visibility issues for new users who don't have a value in the legacy users.club_id column.

-- 1. Update Players Policies
DROP POLICY IF EXISTS "Users can view players from assigned clubs" ON players;
CREATE POLICY "Users can view players from assigned clubs"
    ON players FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        EXISTS (
            SELECT 1 FROM club_members cm 
            WHERE cm.player_id = players.player_id 
            AND cm.club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Club admins can manage their club's players" ON players;
CREATE POLICY "Club admins can manage their club's players" ON players FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (SELECT 1 FROM user_clubs WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update their club's players" ON players;
CREATE POLICY "Club admins can update their club's players" ON players FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
    OR
    EXISTS (
        SELECT 1 FROM club_members cm 
        WHERE cm.player_id = players.player_id 
        AND cm.club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    )
);

-- 2. Update Club Members Policies
DROP POLICY IF EXISTS "Users can view memberships for their club" ON club_members;
CREATE POLICY "Users can view memberships for their club" ON club_members FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can manage memberships for their club" ON club_members;
CREATE POLICY "Club admins can manage memberships for their club" ON club_members FOR ALL
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
);

-- 3. Update Player Groups Policies
DROP POLICY IF EXISTS "Users can view assigned player groups" ON player_groups;
CREATE POLICY "Users can view assigned player groups"
    ON player_groups FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    );

-- 4. Update Group Memberships Policies
DROP POLICY IF EXISTS "Users can view memberships for their club's groups" ON group_memberships;
CREATE POLICY "Users can view memberships for their club's groups" ON group_memberships FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  group_id IN (SELECT group_id FROM player_groups WHERE club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid()))
);

-- 5. Update Match Feedback Policies
DROP POLICY IF EXISTS "Users can view assigned match feedback" ON match_feedback;
CREATE POLICY "Users can view assigned match feedback"
    ON match_feedback FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.match_id = match_feedback.match_id
            AND m.club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
        )
    );

-- 6. Update Player Compatibility Policies
DROP POLICY IF EXISTS "Users can view compatibility from their club" ON player_compatibility;
CREATE POLICY "Users can view compatibility from their club" ON player_compatibility FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
  OR
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.player_id = player_compatibility.player_1_id
    AND cm.club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
  )
);
