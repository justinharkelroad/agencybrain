-- =====================================================
-- Phase 1: Policy Types Management System
-- =====================================================

-- 1. Create policy_types table
CREATE TABLE IF NOT EXISTS public.policy_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.policy_types ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy
CREATE POLICY "Users can manage their agency policy types" 
ON public.policy_types
FOR ALL 
USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- 4. Create index for performance
CREATE INDEX idx_policy_types_agency_id ON public.policy_types(agency_id);
CREATE INDEX idx_policy_types_order ON public.policy_types(agency_id, order_index);

-- 5. Create function to seed default policy types for new agencies
CREATE OR REPLACE FUNCTION public.create_default_policy_types(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if no policy types exist for this agency
  IF NOT EXISTS (SELECT 1 FROM policy_types WHERE agency_id = p_agency_id) THEN
    INSERT INTO policy_types (agency_id, name, order_index) VALUES
      (p_agency_id, 'Auto Insurance', 0),
      (p_agency_id, 'Home Insurance', 1),
      (p_agency_id, 'Life Insurance', 2),
      (p_agency_id, 'Business Insurance', 3),
      (p_agency_id, 'Health Insurance', 4),
      (p_agency_id, 'Other', 5);
  END IF;
END;
$$;

-- 6. Seed defaults for ALL existing agencies
DO $$
DECLARE
  agency_record RECORD;
BEGIN
  FOR agency_record IN SELECT id FROM agencies LOOP
    PERFORM create_default_policy_types(agency_record.id);
  END LOOP;
END;
$$;

-- 7. Update setup_new_agency_defaults trigger to include policy types
CREATE OR REPLACE FUNCTION public.setup_new_agency_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Setup default KPIs FIRST (scorecard rules may reference these)
  PERFORM create_default_kpis(NEW.id);
  
  -- Setup default lead sources
  PERFORM create_default_lead_sources(NEW.id);
  
  -- Setup default policy types
  PERFORM create_default_policy_types(NEW.id);
  
  -- Then setup scorecard rules
  PERFORM create_default_scorecard_rules(NEW.id);
  
  -- Finally setup targets
  PERFORM create_default_targets(NEW.id);
  
  RETURN NEW;
END;
$$;