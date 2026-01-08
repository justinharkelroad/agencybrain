-- Migrate phone column from text to text[]
ALTER TABLE lqs_households 
ALTER COLUMN phone TYPE text[] 
USING CASE WHEN phone IS NULL THEN NULL ELSE ARRAY[phone] END;

-- Add comment for documentation
COMMENT ON COLUMN lqs_households.phone IS 'Array of phone numbers for the household';