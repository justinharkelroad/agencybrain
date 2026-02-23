-- Ensure the agencies table exists on bootstrap environments where the base schema
-- no longer ships it, then add a stable default agency.
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.agencies ENABLE ROW LEVEL SECURITY;

-- Create a default agency for existing users who don't have one
INSERT INTO public.agencies (name) 
VALUES ('Default Agency')
ON CONFLICT (name) DO NOTHING;

-- Add the minimal periods table expected by newer migrations so bootstrap doesn't fail.
CREATE TABLE IF NOT EXISTS public.periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  form_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_periods_user_id ON public.periods(user_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON public.periods(status);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON public.periods(start_date, end_date);

-- Keep uploads tracking table in sync with the newer migrations.
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles for any auth.users that don't have corresponding profiles
INSERT INTO public.profiles (id, agency_id, role)
SELECT 
  au.id,
  (SELECT id FROM public.agencies LIMIT 1),
  CASE WHEN au.email = 'admin@example.com' THEN 'admin' ELSE 'user' END
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
