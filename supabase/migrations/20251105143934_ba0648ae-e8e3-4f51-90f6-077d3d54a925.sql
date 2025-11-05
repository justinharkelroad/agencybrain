-- Create roleplay_sessions table
CREATE TABLE public.roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.roleplay_access_tokens(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_email TEXT NOT NULL,
  created_by UUID NOT NULL,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_transcript JSONB NOT NULL,
  
  grading_data JSONB NOT NULL,
  overall_score TEXT NOT NULL,
  
  pdf_file_path TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(token_id)
);

-- Add session_completed column to roleplay_access_tokens
ALTER TABLE public.roleplay_access_tokens 
ADD COLUMN IF NOT EXISTS session_completed BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX idx_roleplay_sessions_agency_id ON public.roleplay_sessions(agency_id);
CREATE INDEX idx_roleplay_sessions_completed_at ON public.roleplay_sessions(completed_at DESC);

-- RLS policies for roleplay_sessions
ALTER TABLE public.roleplay_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view all sessions
CREATE POLICY "Admins can view all roleplay sessions"
ON public.roleplay_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Agency users can view their agency sessions
CREATE POLICY "Agency users can view their agency roleplay sessions"
ON public.roleplay_sessions
FOR SELECT
USING (
  has_agency_access(auth.uid(), agency_id)
);

-- Edge functions can insert sessions (via service role)
CREATE POLICY "Service role can insert roleplay sessions"
ON public.roleplay_sessions
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for roleplay PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'roleplay-pdfs',
  'roleplay-pdfs',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Admins can view all roleplay PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'roleplay-pdfs' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Agency users can view their agency roleplay PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'roleplay-pdfs' AND
  EXISTS (
    SELECT 1 
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.agency_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Service role can upload roleplay PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'roleplay-pdfs');