-- Add free-form court text for booked matches
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS booked_court_text TEXT;

COMMENT ON COLUMN matches.booked_court_text IS 'Free-form text describing the court details (e.g. "Court 6") for booked matches';
