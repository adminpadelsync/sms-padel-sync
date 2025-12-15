-- Migration: Recommendation Engine Data Model
-- Adds: 0.25 skill level increments, pro verification, scoring cache, ML tracking

-- =====================================================
-- 1. Expand skill level columns to 0.25 increments
-- =====================================================

-- Remove old constraints
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_declared_skill_level_check;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_adjusted_skill_level_check;

-- Update column types to support 0.25 increments (DECIMAL(3,2) for values like 2.75)
ALTER TABLE players 
    ALTER COLUMN declared_skill_level TYPE DECIMAL(3,2),
    ALTER COLUMN adjusted_skill_level TYPE DECIMAL(3,2);

-- Add new constraints with 0.25 increments
ALTER TABLE players ADD CONSTRAINT players_declared_skill_level_check 
    CHECK (declared_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00));

ALTER TABLE players ADD CONSTRAINT players_adjusted_skill_level_check 
    CHECK (adjusted_skill_level IN (2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00));

-- =====================================================
-- 2. Add pro verification fields to players
-- =====================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS pro_verified BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pro_verified_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pro_verified_by UUID;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pro_verification_notes TEXT;

-- =====================================================
-- 3. Add cached scoring fields to players
-- =====================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS responsiveness_score INTEGER DEFAULT 50;
ALTER TABLE players ADD CONSTRAINT players_responsiveness_score_check 
    CHECK (responsiveness_score BETWEEN 0 AND 100);

ALTER TABLE players ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 50;
ALTER TABLE players ADD CONSTRAINT players_reputation_score_check 
    CHECK (reputation_score BETWEEN 0 AND 100);

ALTER TABLE players ADD COLUMN IF NOT EXISTS total_invites_received INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_invites_accepted INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_no_shows INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS average_response_time_seconds INTEGER;

-- =====================================================
-- 4. Add ML tracking fields to match_invites
-- =====================================================

ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS invite_score INTEGER;
ALTER TABLE match_invites ADD CONSTRAINT match_invites_invite_score_check 
    CHECK (invite_score BETWEEN 0 AND 100);

ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER;

-- =====================================================
-- 5. Add invite_batch_size to clubs settings default
-- =====================================================
-- Note: This is stored in the existing JSONB 'settings' column
-- Default value: 6 (handled in application code)

COMMENT ON COLUMN clubs.settings IS 'Club settings including: quiet_hours, business_hours, feedback_delay_hours, invite_batch_size (default 6)';
