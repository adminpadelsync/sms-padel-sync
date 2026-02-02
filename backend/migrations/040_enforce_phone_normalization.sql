-- Migration to enforce phone number normalization at the database level
-- This ensures that regardless of where the data comes from (onboarding, import, admin UI),
-- it is always stored in a consistent digits-only format with a +1 prefix.

CREATE OR REPLACE FUNCTION normalize_phone_number_trigger()
RETURNS TRIGGER AS $$
DECLARE
    clean_digits TEXT;
BEGIN
    -- Strip everything except digits
    clean_digits := regexp_replace(NEW.phone_number, '\D', '', 'g');
    
    IF clean_digits IS NULL OR clean_digits = '' THEN
        RETURN NEW;
    END IF;

    -- Standard US Normalization: 10 digits -> +1, 11 digits starting with 1 -> +
    IF length(clean_digits) = 10 THEN
        NEW.phone_number := '+1' || clean_digits;
    ELSIF length(clean_digits) = 11 AND left(clean_digits, 1) = '1' THEN
        NEW.phone_number := '+' || clean_digits;
    ELSE
        -- Fallback: Just prefix with + if not already handled
        NEW.phone_number := '+' || clean_digits;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to players table
DROP TRIGGER IF EXISTS trg_normalize_player_phone ON players;
CREATE TRIGGER trg_normalize_player_phone
BEFORE INSERT OR UPDATE OF phone_number ON players
FOR EACH ROW EXECUTE FUNCTION normalize_phone_number_trigger();

-- Apply to clubs table
DROP TRIGGER IF EXISTS trg_normalize_club_phone ON clubs;
CREATE TRIGGER trg_normalize_club_phone
BEFORE INSERT OR UPDATE OF phone_number ON clubs
FOR EACH ROW EXECUTE FUNCTION normalize_phone_number_trigger();

-- Apply to player_groups table
DROP TRIGGER IF EXISTS trg_normalize_group_phone ON player_groups;
CREATE TRIGGER trg_normalize_group_phone
BEFORE INSERT OR UPDATE OF phone_number ON player_groups
FOR EACH ROW EXECUTE FUNCTION normalize_phone_number_trigger();
