-- Add is_priority column to renewal_records
ALTER TABLE renewal_records 
ADD COLUMN IF NOT EXISTS is_priority boolean DEFAULT false;

-- Add partial index for efficient priority filtering
CREATE INDEX IF NOT EXISTS idx_renewal_records_priority 
ON renewal_records(agency_id, is_priority) 
WHERE is_priority = true AND is_active = true;