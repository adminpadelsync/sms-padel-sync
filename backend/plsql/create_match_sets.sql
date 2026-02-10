-- Migration: Create match_sets table
-- Stores per-set results within a match, supporting partner swaps and tiebreaks.
-- Each "pairing" (unique team configuration) can have multiple sets.

CREATE TABLE IF NOT EXISTS match_sets (
    set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    team_1_player_1 UUID NOT NULL REFERENCES players(player_id),
    team_1_player_2 UUID NOT NULL REFERENCES players(player_id),
    team_2_player_1 UUID NOT NULL REFERENCES players(player_id),
    team_2_player_2 UUID NOT NULL REFERENCES players(player_id),
    score TEXT NOT NULL,              -- e.g. "6-3", "7-6(5)", "10-8"
    winner_team INTEGER NOT NULL,     -- 1 or 2
    is_tiebreak BOOLEAN DEFAULT false,-- true for super tiebreak (10-point) sets
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(match_id, set_number)
);

-- Index for quick lookup by match
CREATE INDEX IF NOT EXISTS idx_match_sets_match_id ON match_sets(match_id);

-- RLS: Allow service role full access (backend uses service key)
ALTER TABLE match_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on match_sets" ON match_sets
    FOR ALL
    USING (true)
    WITH CHECK (true);
