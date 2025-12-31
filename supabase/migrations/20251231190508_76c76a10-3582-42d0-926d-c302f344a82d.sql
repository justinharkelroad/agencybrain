-- Drop the existing policy on flow_sessions for SELECT
DROP POLICY IF EXISTS "users_can_view_own_or_shared_flow_sessions" ON public.flow_sessions;

-- Create updated policy that allows:
-- 1. Owner can always view their own sessions
-- 2. Anyone can view sessions shared publicly on the exchange
-- 3. Users can view sessions shared privately TO THEM
CREATE POLICY "users_can_view_own_or_shared_flow_sessions" ON public.flow_sessions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM exchange_posts ep
      WHERE ep.content_type = 'flow_result'
      AND (ep.source_reference->>'id')::text = flow_sessions.id::text
      AND (
        ep.private_recipient_id IS NULL
        OR ep.private_recipient_id = auth.uid()
      )
    )
  );