-- Add conversion tracking columns to agency_calls table
ALTER TABLE agency_calls ADD COLUMN IF NOT EXISTS conversion_required BOOLEAN DEFAULT false;
ALTER TABLE agency_calls ADD COLUMN IF NOT EXISTS conversion_attempts INTEGER DEFAULT 0;
ALTER TABLE agency_calls ADD COLUMN IF NOT EXISTS original_file_size_bytes BIGINT;
ALTER TABLE agency_calls ADD COLUMN IF NOT EXISTS converted_file_size_bytes BIGINT;