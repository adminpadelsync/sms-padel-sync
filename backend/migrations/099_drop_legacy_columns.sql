-- Migration: Drop Legacy Columns
-- Purpose: Remove deprecated array columns after Phase 4 cleanup.
-- WARNING: Ensure all code is refactored to use match_participations before running this.

ALTER TABLE matches DROP COLUMN IF EXISTS team_1_players;
ALTER TABLE matches DROP COLUMN IF EXISTS team_2_players;
