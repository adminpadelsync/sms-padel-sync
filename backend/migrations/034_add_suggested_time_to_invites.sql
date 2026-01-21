-- Migration: Add suggested_time to match_invites
-- Purpose: Support "The Diplomat" logic for capturing alternative availability
-- Added: January 21, 2026

ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS suggested_time TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN match_invites.suggested_time IS 'Alternative time suggested by the player when declining an invitation.';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_call_sent BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN matches.last_call_sent IS 'Whether a "Last Call" flash broadcast has been sent for this match.';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS bridge_offer_sent BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN matches.bridge_offer_sent IS 'Whether a "Bridge" time-shift offer has been sent to the organizer.';
