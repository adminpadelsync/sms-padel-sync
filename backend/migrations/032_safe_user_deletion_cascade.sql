-- Migration: Safe User Deletion Cascade
-- Update matches.booked_by to SET NULL on delete to preserve match history

-- 1. Find the current constraint name (usually matches_booked_by_fkey)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'matches_booked_by_fkey' 
        AND table_name = 'matches'
    ) THEN
        ALTER TABLE matches DROP CONSTRAINT matches_booked_by_fkey;
    END IF;
END $$;

-- 2. Re-add with ON DELETE SET NULL
ALTER TABLE matches
ADD CONSTRAINT matches_booked_by_fkey
FOREIGN KEY (booked_by)
REFERENCES users(user_id)
ON DELETE SET NULL;

COMMENT ON CONSTRAINT matches_booked_by_fkey ON matches IS 'Ensures match history is preserved if the booking user is deleted.';
