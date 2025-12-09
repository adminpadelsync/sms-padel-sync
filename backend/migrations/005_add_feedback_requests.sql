-- Track feedback requests sent to players
-- This allows us to:
-- 1. Know when we sent the initial feedback request
-- 2. Know when/if we sent a reminder
-- 3. Avoid sending duplicate requests

CREATE TABLE IF NOT EXISTS feedback_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(match_id),
    player_id UUID NOT NULL REFERENCES players(player_id),
    initial_sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reminder_sent_at TIMESTAMP,
    response_received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_feedback_requests_match_player 
ON feedback_requests(match_id, player_id);

-- Index for finding requests needing reminders
CREATE INDEX IF NOT EXISTS idx_feedback_requests_reminder 
ON feedback_requests(initial_sent_at) 
WHERE reminder_sent_at IS NULL AND response_received_at IS NULL;

-- Comment for documentation
COMMENT ON TABLE feedback_requests IS 'Tracks feedback SMS requests sent to players for reminder logic';
