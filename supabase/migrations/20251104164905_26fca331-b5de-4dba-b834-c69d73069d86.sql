-- Create roleplay_access_tokens table for temporary staff access
CREATE TABLE IF NOT EXISTS public.roleplay_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  
  -- Staff identity (captured before use)
  staff_name text,
  staff_email text,
  
  -- Usage tracking
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  session_id text,
  invalidated boolean NOT NULL DEFAULT false,
  invalidated_at timestamptz,
  invalidated_reason text
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_roleplay_tokens_token ON public.roleplay_access_tokens(token) WHERE NOT used AND NOT invalidated;

-- Index for agency tracking
CREATE INDEX IF NOT EXISTS idx_roleplay_tokens_agency ON public.roleplay_access_tokens(agency_id);

-- Enable RLS
ALTER TABLE public.roleplay_access_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view tokens they created
CREATE POLICY "Users can view their own tokens"
  ON public.roleplay_access_tokens FOR SELECT
  USING (auth.uid() = created_by);

-- Users can create tokens for their agency
CREATE POLICY "Users can create tokens"
  ON public.roleplay_access_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.agency_id = roleplay_access_tokens.agency_id
    )
  );

-- Allow public validation of tokens (needed for staff access)
CREATE POLICY "Public can validate tokens"
  ON public.roleplay_access_tokens FOR SELECT
  USING (true);

-- Allow public updates for identity submission and invalidation
CREATE POLICY "Public can update token usage"
  ON public.roleplay_access_tokens FOR UPDATE
  USING (true);