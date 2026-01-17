-- Add missing columns for unified settings persistence
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS contest_start_date date NULL,
ADD COLUMN IF NOT EXISTS contest_end_date date NULL,
ADD COLUMN IF NOT EXISTS contest_prize text NULL,
ADD COLUMN IF NOT EXISTS notifications_email_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_submissions_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_lateness_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN public.agencies.contest_start_date IS 'Start date for sales contest';
COMMENT ON COLUMN public.agencies.contest_end_date IS 'End date for sales contest';
COMMENT ON COLUMN public.agencies.contest_prize IS 'Prize description for sales contest';
COMMENT ON COLUMN public.agencies.notifications_email_enabled IS 'Master email notifications toggle';
COMMENT ON COLUMN public.agencies.notifications_submissions_enabled IS 'New submission alerts toggle';
COMMENT ON COLUMN public.agencies.notifications_lateness_enabled IS 'Late submission warnings toggle';
COMMENT ON COLUMN public.agencies.auto_reminders_enabled IS 'Daily submission reminders toggle';