-- Add new fields to clubs table for superuser provisioning flow
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS poc_name TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS poc_phone TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS main_phone TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS booking_system TEXT;
