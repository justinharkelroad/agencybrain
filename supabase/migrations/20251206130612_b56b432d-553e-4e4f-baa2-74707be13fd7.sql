-- Create staff_invite_tokens table (follows staff_password_reset_tokens pattern)
CREATE TABLE IF NOT EXISTS public.staff_invite_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_invite_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow service role to manage tokens (used by edge functions)
CREATE POLICY "Service role can manage invite tokens" ON public.staff_invite_tokens
  FOR ALL TO service_role USING (true);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_staff_invite_tokens_token ON public.staff_invite_tokens(token);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_staff_invite_tokens_expires_at ON public.staff_invite_tokens(expires_at);