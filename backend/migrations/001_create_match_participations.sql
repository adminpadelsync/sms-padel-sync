-- Migration: Create match_participations table
-- Purpose: Normalize the connection between matches and players, replacing the UUID[] arrays.

CREATE TABLE IF NOT EXISTS match_participations (
    match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    team_index INTEGER NOT NULL CHECK (team_index IN (1, 2)),
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'invited', 'declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (match_id, player_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_match_participations_player ON match_participations(player_id);
CREATE INDEX IF NOT EXISTS idx_match_participations_match ON match_participations(match_id);

-- Comment:
-- After running this, run 'scripts/migrate_match_players.py' to populate data.
