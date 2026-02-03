-- Add columns to agency_calls for storing AI-generated follow-up templates
-- These are generated on-demand when users click the "Generate Follow-Up" button

ALTER TABLE agency_calls
ADD COLUMN IF NOT EXISTS generated_email_template TEXT,
ADD COLUMN IF NOT EXISTS generated_text_template TEXT,
ADD COLUMN IF NOT EXISTS followup_generated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN agency_calls.generated_email_template IS 'AI-generated follow-up email template based on call analysis';
COMMENT ON COLUMN agency_calls.generated_text_template IS 'AI-generated follow-up SMS/text template based on call analysis';
COMMENT ON COLUMN agency_calls.followup_generated_at IS 'Timestamp when follow-up templates were last generated';
