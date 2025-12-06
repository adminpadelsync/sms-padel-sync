-- Add gender column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));

-- Update existing players to have a default gender (optional, but good for consistency)
-- We'll leave it null for now as we don't know the gender of existing test players
