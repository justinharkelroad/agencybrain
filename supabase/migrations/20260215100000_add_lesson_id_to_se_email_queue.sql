-- Add lesson_id column to sales_experience_email_queue for dedup
-- and neuter the trigger that only queued Week 1 emails

-- 1. Add lesson_id column
ALTER TABLE public.sales_experience_email_queue
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.sales_experience_lessons(id) ON DELETE SET NULL;

-- 2. Dedup index: one email per assignment + lesson + recipient (only for pending/sent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_se_email_queue_dedup
  ON public.sales_experience_email_queue(assignment_id, lesson_id, recipient_email)
  WHERE lesson_id IS NOT NULL AND status IN ('pending', 'sent');

-- 3. Neuter the existing trigger function — email queueing is now handled by
-- the send-sales-lesson-reminder cron function which covers all 8 weeks
CREATE OR REPLACE FUNCTION public.queue_sales_experience_lesson_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Email queueing now handled by send-sales-lesson-reminder cron function.
  -- This trigger is kept as a no-op to avoid dropping it from existing schemas.
  RETURN NEW;
END;
$$;
