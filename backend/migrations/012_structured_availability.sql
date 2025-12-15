-- Migration: Structured Availability Preferences
-- Replaces JSONB availability_preferences with 6 boolean time bucket columns

-- =====================================================
-- 1. Add structured availability columns
-- =====================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekday_morning BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekday_afternoon BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekday_evening BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekend_morning BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekend_afternoon BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avail_weekend_evening BOOLEAN DEFAULT false;

-- =====================================================
-- 2. Remove legacy availability_preferences column
-- =====================================================

ALTER TABLE players DROP COLUMN IF EXISTS availability_preferences;

-- =====================================================
-- Note: Time bucket definitions
-- =====================================================
-- avail_weekday_morning:   Mon-Fri 6am-12pm
-- avail_weekday_afternoon: Mon-Fri 12pm-5pm
-- avail_weekday_evening:   Mon-Fri 5pm-9pm
-- avail_weekend_morning:   Sat-Sun 6am-12pm
-- avail_weekend_afternoon: Sat-Sun 12pm-5pm
-- avail_weekend_evening:   Sat-Sun 5pm-9pm
