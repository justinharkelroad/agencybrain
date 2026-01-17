-- Phase 4: Create normalize_phone function
-- Normalizes phone numbers to 10-digit format for consistent matching

CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
DECLARE
  digits text;
BEGIN
  IF phone IS NULL OR TRIM(phone) = '' THEN
    RETURN NULL;
  END IF;

  digits := REGEXP_REPLACE(phone, '[^0-9]', '', 'g');

  IF LENGTH(digits) >= 10 THEN
    RETURN RIGHT(digits, 10);
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_phone IS 'Normalizes phone to 10-digit format, returns NULL if invalid';

-- Verification query (run after migration):
-- SELECT
--   normalize_phone('(555) 123-4567') as test1,
--   normalize_phone('+1-555-123-4567') as test2,
--   normalize_phone('5551234567') as test3,
--   normalize_phone('123') as test4,
--   normalize_phone(NULL) as test5;
-- Expected: 5551234567, 5551234567, 5551234567, NULL, NULL
