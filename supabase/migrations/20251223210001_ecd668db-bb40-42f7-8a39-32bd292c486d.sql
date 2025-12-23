-- Create staff_core4_monthly_missions table
CREATE TABLE public.staff_core4_monthly_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('body', 'being', 'balance', 'business')),
  title TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  weekly_measurable TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  month_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_core4_monthly_missions ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_staff_core4_monthly_missions_staff_user ON public.staff_core4_monthly_missions(staff_user_id);
CREATE INDEX idx_staff_core4_monthly_missions_month ON public.staff_core4_monthly_missions(staff_user_id, month_year);

-- Unique constraint: one mission per domain per month per staff user
CREATE UNIQUE INDEX idx_staff_core4_monthly_missions_unique 
ON public.staff_core4_monthly_missions(staff_user_id, domain, month_year) 
WHERE status = 'active';

-- RLS policies (edge function handles auth, but allow service role access)
CREATE POLICY "Service role can manage staff missions"
ON public.staff_core4_monthly_missions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);