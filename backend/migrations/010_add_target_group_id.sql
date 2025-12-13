-- Add target_group_id to matches table to support group-specific invites
-- References player_groups table instead of private_groups
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES player_groups(group_id);

COMMENT ON COLUMN matches.target_group_id IS 'If set, invites are restricted to members of this group';
