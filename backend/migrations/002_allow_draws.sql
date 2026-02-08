-- Migration: Allow matches to end in a draw
-- Step 1: Drop the existing check constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_team_check;

-- Step 2: Add a new check constraint that allows 0 (Draw), 1 (Team 1), or 2 (Team 2)
-- We use 0 for draw to be explicit, rather than NULL which might mean 'not yet set'
ALTER TABLE matches ADD CONSTRAINT matches_winner_team_check CHECK (winner_team IN (0, 1, 2));

-- Step 3: Add a comment explaining the values
COMMENT ON COLUMN matches.winner_team IS '1=Team 1, 2=Team 2, 0=Draw';
