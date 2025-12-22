-- Drop the existing policy on flow_sessions for SELECT
DROP POLICY IF EXISTS "users_own_flow_sessions" ON public.flow_sessions;

-- Create a new policy that allows:
-- 1. Owner can always view their own sessions
-- 2. Anyone can view sessions that have been shared on the exchange (non-private posts)
CREATE POLICY "users_can_view_own_or_shared_flow_sessions" ON public.flow_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM exchange_posts ep
      WHERE ep.content_type = 'flow_result'
      AND (ep.source_reference->>'id')::text = flow_sessions.id::text
      AND ep.private_recipient_id IS NULL
    )
  );

-- Keep the existing insert/update/delete policies restricted to owner only
DROP POLICY IF EXISTS "users_insert_own_flow_sessions" ON public.flow_sessions;
CREATE POLICY "users_insert_own_flow_sessions" ON public.flow_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_flow_sessions" ON public.flow_sessions;
CREATE POLICY "users_update_own_flow_sessions" ON public.flow_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_flow_sessions" ON public.flow_sessions;
CREATE POLICY "users_delete_own_flow_sessions" ON public.flow_sessions
  FOR DELETE
  USING (auth.uid() = user_id);