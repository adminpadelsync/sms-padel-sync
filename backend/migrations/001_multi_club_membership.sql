-- Migration: Enable Multi-Club Player Membership
-- Date: 2024-12-10
-- Description: Change unique constraint from phone_number to (phone_number, club_id)
--              This allows the same phone number to register at multiple clubs

-- Step 1: Drop the existing unique constraint on phone_number
-- The constraint name may vary - Supabase typically names it 'players_phone_number_key'
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_phone_number_key;

-- Step 2: Add a new unique constraint on (phone_number, club_id)
ALTER TABLE players ADD CONSTRAINT players_phone_number_club_id_key UNIQUE (phone_number, club_id);

-- Verify the change (optional - for manual verification)
-- SELECT conname, contype, conkey FROM pg_constraint WHERE conrelid = 'players'::regclass;
