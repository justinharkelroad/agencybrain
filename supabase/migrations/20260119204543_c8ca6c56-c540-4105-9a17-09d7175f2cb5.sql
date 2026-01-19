-- Add winback tracking columns to cancel_audit_records
ALTER TABLE cancel_audit_records
ADD COLUMN winback_household_id uuid REFERENCES winback_households(id),
ADD COLUMN sent_to_winback_at timestamp with time zone;

-- Add index for efficient queries on winback-linked records
CREATE INDEX idx_cancel_audit_winback_household 
ON cancel_audit_records(winback_household_id) 
WHERE winback_household_id IS NOT NULL;