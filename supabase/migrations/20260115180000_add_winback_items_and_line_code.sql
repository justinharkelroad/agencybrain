-- Add items_count and line_code columns to winback_policies table
-- for termination analysis features

ALTER TABLE winback_policies
ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 1;

ALTER TABLE winback_policies
ADD COLUMN IF NOT EXISTS line_code TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN winback_policies.items_count IS 'Number of items on the policy (from extended termination report)';
COMMENT ON COLUMN winback_policies.line_code IS 'Allstate line code (e.g., 010=Auto, 070=Homeowners, 072=Landlords)';
