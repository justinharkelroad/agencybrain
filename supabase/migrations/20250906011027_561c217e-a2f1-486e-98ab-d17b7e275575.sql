-- Fix existing Service scorecard rules to 25% each and create default system

-- 1. Fix existing Service scorecard_rules to have 25% each (100% total)
UPDATE scorecard_rules 
SET weights = '{
  "talk_minutes": 25,
  "outbound_calls": 25, 
  "cross_sells_uncovered": 25,
  "mini_reviews": 25
}'::jsonb,
updated_at = now()
WHERE role = 'Service' AND weights IS NOT NULL;

-- 2. Create function to set default scorecard rules for new agencies
CREATE OR REPLACE FUNCTION public.create_default_scorecard_rules(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Sales default scorecard rules
  INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
  VALUES (
    p_agency_id, 
    'Sales',
    ARRAY['outbound_calls', 'talk_minutes', 'quoted_count', 'sold_items'],
    '{
      "outbound_calls": 10,
      "talk_minutes": 20, 
      "quoted_count": 30,
      "sold_items": 40
    }'::jsonb,
    2
  )
  ON CONFLICT (agency_id, role) DO NOTHING;

  -- Service default scorecard rules  
  INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
  VALUES (
    p_agency_id,
    'Service', 
    ARRAY['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews'],
    '{
      "outbound_calls": 25,
      "talk_minutes": 25,
      "cross_sells_uncovered": 25, 
      "mini_reviews": 25
    }'::jsonb,
    2
  )
  ON CONFLICT (agency_id, role) DO NOTHING;
END;
$$;

-- 3. Create function to set default targets for new agencies
CREATE OR REPLACE FUNCTION public.create_default_targets(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Sales default targets
  INSERT INTO targets (agency_id, metric_key, value_number)
  VALUES 
    (p_agency_id, 'outbound_calls', 100),
    (p_agency_id, 'talk_minutes', 180), 
    (p_agency_id, 'quoted_count', 5),
    (p_agency_id, 'sold_items', 2),
    (p_agency_id, 'sold_policies', 2),
    (p_agency_id, 'sold_premium', 1000)
  ON CONFLICT (agency_id, metric_key, team_member_id) DO NOTHING;

  -- Service default targets
  INSERT INTO targets (agency_id, metric_key, value_number)
  VALUES
    (p_agency_id, 'outbound_calls', 30),
    (p_agency_id, 'talk_minutes', 180),
    (p_agency_id, 'cross_sells_uncovered', 2), 
    (p_agency_id, 'mini_reviews', 5)
  ON CONFLICT (agency_id, metric_key, team_member_id) DO NOTHING;
END;
$$;

-- 4. Apply defaults to existing agencies that don't have proper setup
DO $$
DECLARE
  agency_record RECORD;
BEGIN
  FOR agency_record IN SELECT id FROM agencies LOOP
    -- Create default scorecard rules if missing
    PERFORM create_default_scorecard_rules(agency_record.id);
    
    -- Create default targets if missing  
    PERFORM create_default_targets(agency_record.id);
  END LOOP;
END;
$$;

-- 5. Create trigger to automatically setup defaults for new agencies
CREATE OR REPLACE FUNCTION public.setup_new_agency_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Setup default scorecard rules and targets for new agency
  PERFORM create_default_scorecard_rules(NEW.id);
  PERFORM create_default_targets(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS setup_agency_defaults_trigger ON agencies;

-- Create trigger for new agencies
CREATE TRIGGER setup_agency_defaults_trigger
  AFTER INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION setup_new_agency_defaults();