-- Final Corrected Migration: Multi-Tenant User Management (user_clubs)
-- Date: 2026-01-08

-- 1. Create user_clubs table
CREATE TABLE IF NOT EXISTS user_clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('club_admin', 'club_staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, club_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_clubs_user_id ON user_clubs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clubs_club_id ON user_clubs(club_id);

-- 2. Enable RLS on user_clubs
ALTER TABLE user_clubs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy for user_clubs
DROP POLICY IF EXISTS "Users can view their own club assignments" ON user_clubs;
CREATE POLICY "Users can view their own club assignments"
    ON user_clubs FOR SELECT
    USING (user_id = auth.uid() OR (SELECT is_superuser FROM users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Superusers can manage user_clubs" ON user_clubs;
CREATE POLICY "Superusers can manage user_clubs"
    ON user_clubs FOR ALL
    USING ((SELECT is_superuser FROM users WHERE user_id = auth.uid()));

-- 4. Update existing RLS policies to use user_clubs instead of users.club_id

-- Clubs (Has club_id)
DROP POLICY IF EXISTS "Users can view their own club" ON clubs;
DROP POLICY IF EXISTS "Users can view assigned clubs" ON clubs;
CREATE POLICY "Users can view assigned clubs"
    ON clubs FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    );

-- Players (NO club_id, uses club_members)
DROP POLICY IF EXISTS "Users can view players from their club" ON players;
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

-- Matches (Has club_id)
DROP POLICY IF EXISTS "Users can view matches from their club" ON matches;
DROP POLICY IF EXISTS "Users can view matches from assigned clubs" ON matches;
CREATE POLICY "Users can view matches from assigned clubs"
    ON matches FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    );

-- Courts (Has club_id)
DROP POLICY IF EXISTS "Users can view courts from their club" ON courts;
DROP POLICY IF EXISTS "Users can view assigned courts" ON courts;
CREATE POLICY "Users can view assigned courts"
    ON courts FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    );

-- Player Groups / Private Groups (Has club_id)
DROP POLICY IF EXISTS "Users can view private groups from their club" ON player_groups;
DROP POLICY IF EXISTS "Users can view assigned player groups" ON player_groups;
CREATE POLICY "Users can view assigned player groups"
    ON player_groups FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
    );

-- Match Invites (NO club_id, use match_id -> matches.club_id)
DROP POLICY IF EXISTS "Users can view invites from their club" ON match_invites;
DROP POLICY IF EXISTS "Users can view assigned match invites" ON match_invites;
CREATE POLICY "Users can view assigned match invites"
    ON match_invites FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND is_superuser = true)
        OR
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.match_id = match_invites.match_id
            AND m.club_id IN (SELECT club_id FROM user_clubs WHERE user_id = auth.uid())
        )
    );

-- Match Feedback (NO club_id, use match_id -> matches.club_id)
DROP POLICY IF EXISTS "Users can view feedback from their club's matches" ON match_feedback;
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
