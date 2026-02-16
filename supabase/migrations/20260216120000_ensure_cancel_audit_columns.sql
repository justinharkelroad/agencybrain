-- Ensure original_year and cancel_status columns exist on cancel_audit_records.
-- These were supposed to be added by earlier migrations but may be missing.

ALTER TABLE cancel_audit_records ADD COLUMN IF NOT EXISTS original_year TEXT;
ALTER TABLE cancel_audit_records ADD COLUMN IF NOT EXISTS cancel_status TEXT;

CREATE INDEX IF NOT EXISTS idx_cancel_audit_records_original_year
ON cancel_audit_records (agency_id, original_year);

NOTIFY pgrst, 'reload schema';
