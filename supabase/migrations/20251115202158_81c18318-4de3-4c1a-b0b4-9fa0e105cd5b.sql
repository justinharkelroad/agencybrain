-- Migration: Add year to quarters (YYYY-QX format)
-- This updates existing quarter data to include the year based on created_at

-- Step 1: Backfill existing records with year based on created_at
UPDATE life_targets_quarterly
SET quarter = EXTRACT(YEAR FROM created_at)::text || '-' || quarter
WHERE quarter NOT LIKE '%-%';

-- Step 2: Verify no duplicates exist after migration
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, quarter, COUNT(*) as cnt
    FROM life_targets_quarterly
    GROUP BY user_id, quarter
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: Found % duplicate user_id+quarter combinations', duplicate_count;
  END IF;
END $$;