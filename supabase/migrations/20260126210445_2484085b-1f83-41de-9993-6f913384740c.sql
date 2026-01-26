-- Create staff_flow_sessions table for staff flow sessions
-- This follows the same pattern as staff_flow_profiles

CREATE TABLE IF NOT EXISTS public.staff_flow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  flow_template_id uuid NOT NULL REFERENCES public.flow_templates(id) ON DELETE CASCADE,
  title text,
  domain text,
  responses_json jsonb DEFAULT '{}',
  ai_analysis_json jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at timestamptz,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_flow_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for edge function service role access
CREATE POLICY "Service role can manage staff_flow_sessions"
  ON public.staff_flow_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for faster lookups by staff user
CREATE INDEX IF NOT EXISTS idx_staff_flow_sessions_staff_user_id ON public.staff_flow_sessions(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_flow_sessions_template_id ON public.staff_flow_sessions(flow_template_id);
CREATE INDEX IF NOT EXISTS idx_staff_flow_sessions_status ON public.staff_flow_sessions(status);