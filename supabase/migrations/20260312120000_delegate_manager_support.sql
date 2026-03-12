-- Allow staff delegate managers to send messages (they don't have profiles entries)
-- sender_user_id was NOT NULL REFERENCES profiles(id) — must be nullable for staff delegates
ALTER TABLE public.sales_experience_messages
  ALTER COLUMN sender_user_id DROP NOT NULL;

-- Add staff_user_id so we can track which staff delegate sent the message
ALTER TABLE public.sales_experience_messages
  ADD COLUMN IF NOT EXISTS staff_sender_id uuid REFERENCES public.staff_users(id);

-- Ensure every message has at least one sender identity (CLAUDE.md Rule 5)
ALTER TABLE public.sales_experience_messages
  DROP CONSTRAINT IF EXISTS must_have_sender;
ALTER TABLE public.sales_experience_messages
  ADD CONSTRAINT must_have_sender CHECK (sender_user_id IS NOT NULL OR staff_sender_id IS NOT NULL);

-- Update the insert policy to allow service-role inserts (edge function uses service key)
-- The existing policy requires sender_user_id = auth.uid() which blocks staff delegates.
-- Edge functions already verify auth before inserting, so we relax the policy.
DROP POLICY IF EXISTS "se_messages_insert" ON public.sales_experience_messages;
CREATE POLICY "se_messages_insert" ON public.sales_experience_messages
FOR INSERT WITH CHECK (
  (
    -- JWT user: must be sender
    sender_user_id = auth.uid()
  )
  OR
  (
    -- Staff delegate: sender_user_id is null, inserted via service role edge function
    sender_user_id IS NULL AND staff_sender_id IS NOT NULL
  )
  OR
  (
    -- Admin/service role path
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
);

-- Allow staff delegate managers to create AI builder sessions
-- user_id was NOT NULL REFERENCES auth.users(id) — must be nullable for staff delegates
ALTER TABLE public.sales_experience_deliverable_sessions
  ALTER COLUMN user_id DROP NOT NULL;

-- Add staff_user_id so we can track which staff delegate created the session
ALTER TABLE public.sales_experience_deliverable_sessions
  ADD COLUMN IF NOT EXISTS staff_user_id uuid REFERENCES public.staff_users(id);

-- Ensure every session has at least one creator identity (CLAUDE.md Rule 5)
ALTER TABLE public.sales_experience_deliverable_sessions
  DROP CONSTRAINT IF EXISTS must_have_session_creator;
ALTER TABLE public.sales_experience_deliverable_sessions
  ADD CONSTRAINT must_have_session_creator CHECK (user_id IS NOT NULL OR staff_user_id IS NOT NULL);

-- Relax the RLS policy for deliverable sessions to allow service-role inserts for staff delegates
DROP POLICY IF EXISTS "se_deliverable_sessions_select" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_select" ON public.sales_experience_deliverable_sessions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  )
  -- Staff delegates access via service role (edge function), so no direct RLS needed
);

DROP POLICY IF EXISTS "se_deliverable_sessions_insert" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_insert" ON public.sales_experience_deliverable_sessions
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR (user_id IS NULL AND staff_user_id IS NOT NULL)
);

DROP POLICY IF EXISTS "se_deliverable_sessions_update" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_update" ON public.sales_experience_deliverable_sessions
FOR UPDATE USING (
  user_id = auth.uid()
  OR (user_id IS NULL AND staff_user_id IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';
