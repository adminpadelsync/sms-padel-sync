-- Migration: Add twilio_sid to clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS twilio_sid TEXT;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_clubs_twilio_sid ON clubs(twilio_sid);
