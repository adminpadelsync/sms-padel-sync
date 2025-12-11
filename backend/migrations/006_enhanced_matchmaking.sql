-- Enhanced Matchmaking Migration
-- Adds columns for batched invites, timeouts, preferences, and muting

-- Add expires_at and batch_number to match_invites
ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1;

-- Add muted_until to players for daily opt-out
ALTER TABLE players ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP;

-- Add match preferences to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS level_range_min FLOAT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS level_range_max FLOAT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS gender_preference VARCHAR(10) DEFAULT 'mixed';

-- Add index for efficient timeout queries
CREATE INDEX IF NOT EXISTS idx_match_invites_expires_at 
ON match_invites(expires_at) 
WHERE status = 'sent';

-- Add index for muted player lookup
CREATE INDEX IF NOT EXISTS idx_players_muted_until 
ON players(muted_until) 
WHERE muted_until IS NOT NULL;
