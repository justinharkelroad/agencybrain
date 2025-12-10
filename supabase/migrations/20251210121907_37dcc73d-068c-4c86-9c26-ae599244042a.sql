-- Create function to seed default lead sources for new agencies
CREATE OR REPLACE FUNCTION public.create_default_lead_sources(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only seed if no lead sources exist for this agency
  IF NOT EXISTS (SELECT 1 FROM lead_sources WHERE agency_id = p_agency_id) THEN
    INSERT INTO lead_sources (agency_id, name, order_index, is_active) VALUES
      (p_agency_id, 'Referral', 0, true),
      (p_agency_id, 'Website', 1, true),
      (p_agency_id, 'Cold Call', 2, true),
      (p_agency_id, 'Walk-In', 3, true),
      (p_agency_id, 'Social Media', 4, true),
      (p_agency_id, 'Google/Search', 5, true),
      (p_agency_id, 'Event/Networking', 6, true),
      (p_agency_id, 'Other', 7, true);
  END IF;
END;
$$;

-- Update setup_new_agency_defaults to include lead sources
CREATE OR REPLACE FUNCTION public.setup_new_agency_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Setup default KPIs
  PERFORM create_default_kpis(NEW.id);
  
  -- Setup default lead sources
  PERFORM create_default_lead_sources(NEW.id);
  
  -- Setup default scorecard rules
  PERFORM create_default_scorecard_rules(NEW.id);
  
  -- Setup default targets
  PERFORM create_default_targets(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Backfill existing agencies with default lead sources
DO $$
DECLARE
  agency_record record;
BEGIN
  FOR agency_record IN SELECT id FROM agencies LOOP
    PERFORM create_default_lead_sources(agency_record.id);
  END LOOP;
END;
$$;