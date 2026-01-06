-- Fix the generate_household_key function - the regex flag 'g' needs to KEEP alpha chars, not remove them
CREATE OR REPLACE FUNCTION public.generate_household_key(
  p_first_name TEXT,
  p_last_name TEXT,
  p_zip_code TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(REGEXP_REPLACE(COALESCE(p_last_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
         UPPER(REGEXP_REPLACE(COALESCE(p_first_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
         COALESCE(LEFT(p_zip_code, 5), '00000');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;