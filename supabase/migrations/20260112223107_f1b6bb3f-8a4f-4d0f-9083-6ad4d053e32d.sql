-- Add cancel_status column to store the Excel Status column value
ALTER TABLE cancel_audit_records 
ADD COLUMN cancel_status text DEFAULT 'Cancelled';

COMMENT ON COLUMN cancel_audit_records.cancel_status IS 'From Excel Status column: Cancel (pending/savable) or Cancelled (already lost)';