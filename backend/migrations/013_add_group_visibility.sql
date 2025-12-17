-- Add visibility column to player_groups
ALTER TABLE player_groups 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
CHECK (visibility IN ('private', 'open', 'public'));

-- Add comment to explain visibility types
COMMENT ON COLUMN player_groups.visibility IS 'Visibility level of the group: private (unlisted, admin adding only), open (unlisted, anyone can join), public (listed, anyone can join)';
