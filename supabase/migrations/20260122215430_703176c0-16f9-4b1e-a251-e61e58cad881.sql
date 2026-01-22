-- Create landing page leads table for lead capture form
CREATE TABLE public.landing_page_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  carrier TEXT NOT NULL CHECK (carrier IN ('Allstate', 'State Farm', 'Farmers', 'Independent', 'Other')),
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'landing_page',
  ip_address TEXT,
  user_agent TEXT
);

-- RLS: Allow public inserts (no auth required for landing page)
ALTER TABLE public.landing_page_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.landing_page_leads
  FOR INSERT WITH CHECK (true);

-- Admins can read all leads (using role column)
CREATE POLICY "Admins can read leads" ON public.landing_page_leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );