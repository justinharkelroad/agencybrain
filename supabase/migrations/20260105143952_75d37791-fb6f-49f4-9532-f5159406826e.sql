-- Enable call scoring email notifications for all agencies
UPDATE public.agencies 
SET call_scoring_email_enabled = true 
WHERE call_scoring_email_enabled = false OR call_scoring_email_enabled IS NULL;