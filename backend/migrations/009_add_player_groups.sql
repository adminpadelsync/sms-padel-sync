-- Drop existing private_groups table (unused)
DROP TABLE IF EXISTS private_groups;

-- Create player_groups table
CREATE TABLE player_groups (
  group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create group_memberships table
CREATE TABLE group_memberships (
  group_id UUID NOT NULL REFERENCES player_groups(group_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, player_id)
);
