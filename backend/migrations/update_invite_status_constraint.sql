-- Update match_invites status constraint to include 'maybe' and 'removed'
-- Run this in Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE match_invites DROP CONSTRAINT IF EXISTS match_invites_status_check;

-- Add the new constraint with 'maybe' and 'removed' included
ALTER TABLE match_invites ADD CONSTRAINT match_invites_status_check 
  CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'maybe', 'removed', 'pending_sms'));
