-- Migration to support Batch Throttling
-- Adds refilled_at column and updates status constraint

ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS refilled_at TIMESTAMP WITH TIME ZONE;

-- Update status constraint to include pending_sms
ALTER TABLE match_invites DROP CONSTRAINT IF EXISTS match_invites_status_check;
ALTER TABLE match_invites ADD CONSTRAINT match_invites_status_check CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'maybe', 'removed', 'pending_sms'));
