-- Add booking tracking and originator to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS court_booked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS originator_id UUID REFERENCES players(player_id),
ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS booked_by UUID REFERENCES users(user_id);

COMMENT ON COLUMN matches.court_booked IS 'True if the court has been manually booked in the club system';
COMMENT ON COLUMN matches.originator_id IS 'The player who initiated the match request';
COMMENT ON COLUMN matches.booked_at IS 'When the match was marked as booked';
COMMENT ON COLUMN matches.booked_by IS 'The staff member who marked it as booked';
