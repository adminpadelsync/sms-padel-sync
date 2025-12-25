-- Add result nudge tracking to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS result_nudge_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_result_nudge_at TIMESTAMP WITH TIME ZONE;

-- Commentary: 
-- result_nudge_count tracks how many times we've pinged the organizer for results.
-- last_result_nudge_at allows us to space out the follow-up nudge (e.g., 4 hours after the first).
