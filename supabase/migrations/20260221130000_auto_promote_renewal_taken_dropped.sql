-- Auto-promote "Renewal Taken" + dropped records to customer stage.
-- When a record has renewal_status = 'Renewal Taken' and drops off the report,
-- the carrier already confirmed the renewal. These are customers, not pending work.

-- 1. Add tracking column so we know why a record was auto-resolved
ALTER TABLE renewal_records
ADD COLUMN IF NOT EXISTS auto_resolved_reason text;

COMMENT ON COLUMN renewal_records.auto_resolved_reason IS
  'Reason a record was auto-resolved. Values: renewal_taken_dropped (carrier confirmed renewal, then dropped from report)';

-- 2. Backfill: promote all existing dropped + "Renewal Taken" records to success
UPDATE renewal_records
SET
  current_status = 'success',
  auto_resolved_reason = 'renewal_taken_dropped',
  updated_at = now()
WHERE is_active = false
  AND dropped_from_report_at IS NOT NULL
  AND renewal_status = 'Renewal Taken'
  AND current_status IN ('uncontacted', 'pending');
