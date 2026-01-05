-- Comprehensive fix for naive timestamp columns in SMS Padel Sync
-- These columns should be TIMESTAMPTZ to properly handle localization and avoid 5-8 hour shifts.

-- 1. Matches Table (Most critical)
ALTER TABLE matches ALTER COLUMN scheduled_time SET DATA TYPE TIMESTAMPTZ USING scheduled_time AT TIME ZONE 'UTC';
ALTER TABLE matches ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE matches ALTER COLUMN confirmed_at SET DATA TYPE TIMESTAMPTZ USING confirmed_at AT TIME ZONE 'UTC';
ALTER TABLE matches ALTER COLUMN voting_deadline SET DATA TYPE TIMESTAMPTZ USING voting_deadline AT TIME ZONE 'UTC';
ALTER TABLE matches ALTER COLUMN booked_at SET DATA TYPE TIMESTAMPTZ USING booked_at AT TIME ZONE 'UTC';

-- 2. Match Invites
ALTER TABLE match_invites ALTER COLUMN sent_at SET DATA TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'UTC';
ALTER TABLE match_invites ALTER COLUMN responded_at SET DATA TYPE TIMESTAMPTZ USING responded_at AT TIME ZONE 'UTC';
ALTER TABLE match_invites ALTER COLUMN expires_at SET DATA TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';

-- 3. Players
ALTER TABLE players ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE players ALTER COLUMN last_active SET DATA TYPE TIMESTAMPTZ USING last_active AT TIME ZONE 'UTC';
ALTER TABLE players ALTER COLUMN muted_until SET DATA TYPE TIMESTAMPTZ USING muted_until AT TIME ZONE 'UTC';
ALTER TABLE players ALTER COLUMN pro_verified_at SET DATA TYPE TIMESTAMPTZ USING pro_verified_at AT TIME ZONE 'UTC';
ALTER TABLE players ALTER COLUMN last_level_adjustment_date SET DATA TYPE TIMESTAMPTZ USING last_level_adjustment_date AT TIME ZONE 'UTC';

-- 4. Clubs
ALTER TABLE clubs ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 5. Membership/Groups
ALTER TABLE club_members ALTER COLUMN added_at SET DATA TYPE TIMESTAMPTZ USING added_at AT TIME ZONE 'UTC';
ALTER TABLE player_groups ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE group_memberships ALTER COLUMN added_at SET DATA TYPE TIMESTAMPTZ USING added_at AT TIME ZONE 'UTC';

-- 6. Feedback & Rating History
ALTER TABLE match_feedback ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE player_rating_history ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 7. Audit/Logs
ALTER TABLE error_logs ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE sms_outbox ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE sms_outbox ALTER COLUMN read_at SET DATA TYPE TIMESTAMPTZ USING read_at AT TIME ZONE 'UTC';
ALTER TABLE assessment_results ALTER COLUMN created_at SET DATA TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE player_compatibility ALTER COLUMN last_updated SET DATA TYPE TIMESTAMPTZ USING last_updated AT TIME ZONE 'UTC';
ALTER TABLE player_compatibility ALTER COLUMN last_match_together SET DATA TYPE TIMESTAMPTZ USING last_match_together AT TIME ZONE 'UTC';
