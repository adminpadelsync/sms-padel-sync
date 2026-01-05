-- Fix missing ON DELETE clauses for player references
-- This ensures that if a player is truly deleted, referenced rows are either deleted or set to NULL.

ALTER TABLE matches 
  DROP CONSTRAINT IF EXISTS matches_originator_id_fkey,
  ADD CONSTRAINT matches_originator_id_fkey 
  FOREIGN KEY (originator_id) REFERENCES players(player_id) ON DELETE SET NULL;

-- Note: match_invites should probably CASCADE if the player is gone.
ALTER TABLE match_invites
  DROP CONSTRAINT IF EXISTS match_invites_player_id_fkey,
  ADD CONSTRAINT match_invites_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE;

-- feedback should also cascade if player is gone
ALTER TABLE match_feedback
  DROP CONSTRAINT IF EXISTS match_feedback_player_id_fkey,
  ADD CONSTRAINT match_feedback_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE;

-- compatibilities should cascade
ALTER TABLE player_compatibility
  DROP CONSTRAINT IF EXISTS player_compatibility_player_1_id_fkey,
  ADD CONSTRAINT player_compatibility_player_1_id_fkey
  FOREIGN KEY (player_1_id) REFERENCES players(player_id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS player_compatibility_player_2_id_fkey,
  ADD CONSTRAINT player_compatibility_player_2_id_fkey
  FOREIGN KEY (player_2_id) REFERENCES players(player_id) ON DELETE CASCADE;

-- logs should be set null to preserve context if possible
ALTER TABLE error_logs
  DROP CONSTRAINT IF EXISTS error_logs_player_id_fkey,
  ADD CONSTRAINT error_logs_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE SET NULL;
