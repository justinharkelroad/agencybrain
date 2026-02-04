-- Add morning_digest_sections JSONB column to agencies table
-- This allows agencies to customize which sections appear in their morning digest email

ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS morning_digest_sections JSONB DEFAULT '{
  "salesSnapshot": true,
  "activityMetrics": true,
  "callScoring": true,
  "atRiskPolicies": true,
  "renewalsDue": true,
  "sequenceTasks": true,
  "trainingCompletions": true
}'::jsonb;

-- Add a comment explaining the column
COMMENT ON COLUMN public.agencies.morning_digest_sections IS 'JSON object controlling which sections to include in the morning digest email. All sections default to true (included).';
