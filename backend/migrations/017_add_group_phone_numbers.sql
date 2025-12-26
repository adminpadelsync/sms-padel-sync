-- Migration: Add dedicated phone numbers to player_groups
ALTER TABLE player_groups 
ADD COLUMN phone_number TEXT UNIQUE,
ADD COLUMN twilio_sid TEXT;

-- Index for fast lookup by incoming SMS number
CREATE INDEX idx_player_groups_phone_number ON player_groups(phone_number);
