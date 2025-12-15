-- Add call_type enum for Sales vs Service calls
DO $$ BEGIN
  CREATE TYPE call_type_enum AS ENUM ('sales', 'service');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add call_type column to scoring templates table
ALTER TABLE call_scoring_templates 
ADD COLUMN IF NOT EXISTS call_type call_type_enum DEFAULT 'sales';

-- Update existing templates to 'sales' (they were all sales before)
UPDATE call_scoring_templates SET call_type = 'sales' WHERE call_type IS NULL;

-- Add call_type column to agency_calls table to preserve the type even if template changes
ALTER TABLE agency_calls 
ADD COLUMN IF NOT EXISTS call_type call_type_enum DEFAULT 'sales';

-- Update existing calls to 'sales'
UPDATE agency_calls SET call_type = 'sales' WHERE call_type IS NULL;