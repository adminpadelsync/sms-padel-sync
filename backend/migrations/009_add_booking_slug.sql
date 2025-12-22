-- Migration: Add booking_slug to clubs table
-- Description: This slug is used to construct booking URLs (e.g., https://slug.playbypoint.com/book/slug)
-- Created: 2025-12-22

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS booking_slug TEXT;

COMMENT ON COLUMN clubs.booking_slug IS 'URL identifier for the club''s booking system (e.g. "replay" for Playbypoint)';
