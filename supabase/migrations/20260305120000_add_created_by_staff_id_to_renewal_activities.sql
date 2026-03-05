-- Add created_by_staff_id to renewal_activities so staff users are properly tracked
-- Previously all staff activities had created_by = NULL with only display_name set

-- 1. Add the column
ALTER TABLE renewal_activities
  ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

-- 2. Create index for lookups
CREATE INDEX idx_renewal_activities_created_by_staff_id
  ON renewal_activities(created_by_staff_id)
  WHERE created_by_staff_id IS NOT NULL;

-- 3. Backfill existing staff activities by matching display_name + agency_id
-- This covers all historical records where created_by IS NULL (staff users)
UPDATE renewal_activities ra
SET created_by_staff_id = su.id
FROM staff_users su
WHERE ra.created_by IS NULL
  AND ra.created_by_staff_id IS NULL
  AND ra.created_by_display_name IS NOT NULL
  AND ra.agency_id = su.agency_id
  AND lower(trim(ra.created_by_display_name)) = lower(trim(su.display_name));
