-- Fix renewal_uploads table to match expected schema

-- Rename columns to match code expectations
ALTER TABLE renewal_uploads RENAME COLUMN uploaded_by_user_id TO uploaded_by;
ALTER TABLE renewal_uploads RENAME COLUMN uploaded_by_name TO uploaded_by_display_name;
ALTER TABLE renewal_uploads RENAME COLUMN file_name TO filename;

-- Drop columns not needed
ALTER TABLE renewal_uploads DROP COLUMN IF EXISTS uploaded_by_staff_id;
ALTER TABLE renewal_uploads DROP COLUMN IF EXISTS records_processed;
ALTER TABLE renewal_uploads DROP COLUMN IF EXISTS records_created;
ALTER TABLE renewal_uploads DROP COLUMN IF EXISTS records_updated;

-- Add missing columns
ALTER TABLE renewal_uploads ADD COLUMN IF NOT EXISTS record_count INTEGER DEFAULT 0;
ALTER TABLE renewal_uploads ADD COLUMN IF NOT EXISTS date_range_start TEXT;
ALTER TABLE renewal_uploads ADD COLUMN IF NOT EXISTS date_range_end TEXT;

-- Fix uploaded_by_display_name to be nullable (was NOT NULL)
ALTER TABLE renewal_uploads ALTER COLUMN uploaded_by_display_name DROP NOT NULL;

-- Drop and recreate RLS policies with correct single-param function call style
DROP POLICY IF EXISTS renewal_uploads_select ON renewal_uploads;
DROP POLICY IF EXISTS renewal_uploads_insert ON renewal_uploads;
DROP POLICY IF EXISTS renewal_uploads_delete ON renewal_uploads;

CREATE POLICY "Users can view renewal uploads for their agency"
  ON renewal_uploads FOR SELECT
  USING (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert renewal uploads for their agency"
  ON renewal_uploads FOR INSERT
  WITH CHECK (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete renewal uploads for their agency"
  ON renewal_uploads FOR DELETE
  USING (has_renewal_access(auth.uid(), agency_id));