-- Create staff_flow_profiles table for staff users (separate from auth.users)
CREATE TABLE IF NOT EXISTS public.staff_flow_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  full_name text,
  preferred_name text,
  life_roles text[],
  core_values text[],
  current_goals text,
  current_challenges text,
  spiritual_beliefs text,
  faith_tradition text,
  background_notes text,
  accountability_style text,
  feedback_preference text,
  peak_state text,
  growth_edge text,
  overwhelm_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(staff_user_id)
);

-- Enable RLS
ALTER TABLE public.staff_flow_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for edge function service role access
CREATE POLICY "Service role can manage staff_flow_profiles"
  ON public.staff_flow_profiles FOR ALL
  USING (true)
  WITH CHECK (true);