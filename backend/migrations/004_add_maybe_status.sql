ALTER TABLE match_invites DROP CONSTRAINT IF EXISTS match_invites_status_check;
ALTER TABLE match_invites ADD CONSTRAINT match_invites_status_check CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'maybe'));
