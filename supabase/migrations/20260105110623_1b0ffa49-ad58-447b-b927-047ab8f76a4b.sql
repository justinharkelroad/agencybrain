-- Add call scoring email notification setting to agencies
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS call_scoring_email_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.agencies.call_scoring_email_enabled IS 
'When true, sends scorecard results to team member, agency owner, and managers when a call is analyzed';