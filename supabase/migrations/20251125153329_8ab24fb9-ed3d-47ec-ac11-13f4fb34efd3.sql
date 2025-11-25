-- Create staff_sessions table for database-based authentication
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE NOT NULL,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  is_valid boolean DEFAULT true NOT NULL
);

-- Add index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON public.staff_sessions(session_token) WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON public.staff_sessions(staff_user_id);

-- Enable RLS on staff_sessions
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage sessions (edge functions will use service role)
CREATE POLICY "Service role can manage staff sessions"
  ON public.staff_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup function to remove expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_staff_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.staff_sessions
  WHERE expires_at < now() OR is_valid = false;
END;
$$;