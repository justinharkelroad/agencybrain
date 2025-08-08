-- Phase 1: RLS policy to allow clients to view only shared assistant messages for their own shared analyses

-- Ensure idempotency by dropping the policy if it already exists
DROP POLICY IF EXISTS "Clients can view shared assistant messages for their analyses" ON public.ai_chat_messages;

-- Create strict SELECT policy for clients
CREATE POLICY "Clients can view shared assistant messages for their analyses"
ON public.ai_chat_messages
FOR SELECT
USING (
  -- The message itself must be explicitly shared
  shared_with_client = true
  AND role = 'assistant'
  AND EXISTS (
    SELECT 1
    FROM public.ai_analysis a
    WHERE a.id = ai_chat_messages.analysis_id
      -- The analysis must also be shared with the client
      AND a.shared_with_client = true
      -- The analysis must belong to the authenticated user, either directly or via period ownership
      AND (
        a.user_id = auth.uid()
        OR (
          a.period_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.periods p
            WHERE p.id = a.period_id
              AND p.user_id = auth.uid()
          )
        )
      )
  )
);
