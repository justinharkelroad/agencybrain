-- Add source tracking to winback_policies
-- Tracks where each policy record originated: csv_upload, renewal_audit, or cancel_audit
-- Also links policies directly to their source upload for reliable delete operations
-- (last_upload_id on winback_households gets overwritten by subsequent uploads, orphaning data)

-- Add source column with default for existing rows
ALTER TABLE winback_policies
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'csv_upload',
  ADD COLUMN IF NOT EXISTS source_upload_id UUID REFERENCES winback_uploads(id) ON DELETE SET NULL;

-- Backfill source from termination_reason for non-CSV records
UPDATE winback_policies
SET source = 'renewal_audit'
WHERE termination_reason = 'Renewal Not Taken - From Renewal Audit';

UPDATE winback_policies
SET source = 'cancel_audit'
WHERE termination_reason = 'Lost from Cancel Audit';

-- Index for efficient delete-upload lookups and Termination Analysis filtering
CREATE INDEX IF NOT EXISTS idx_winback_policies_source_upload
  ON winback_policies (source_upload_id)
  WHERE source_upload_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_winback_policies_source
  ON winback_policies (agency_id, source, termination_effective_date);
