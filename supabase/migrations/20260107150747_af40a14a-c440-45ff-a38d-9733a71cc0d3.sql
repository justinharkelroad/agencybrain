-- Drop and recreate backfill function with correct parameter order
DROP FUNCTION IF EXISTS public.backfill_lqs_sales_matching(uuid);

CREATE OR REPLACE FUNCTION public.backfill_lqs_sales_matching(p_agency_id uuid)
RETURNS TABLE(sale_id uuid, household_id uuid, match_confidence text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_match RECORD;
BEGIN
  FOR v_sale IN 
    SELECT s.id 
    FROM sales s
    WHERE s.agency_id = p_agency_id
      AND NOT EXISTS (
        SELECT 1 FROM lqs_sales ls 
        WHERE ls.source_reference_id = s.id::text
      )
  LOOP
    SELECT * INTO v_match 
    FROM match_sale_to_lqs_household(v_sale.id)
    LIMIT 1;
    
    IF FOUND AND v_match.household_id IS NOT NULL THEN
      -- FIX: Correct parameter order (household_id first, sale_id second)
      PERFORM link_sale_to_lqs_household(v_match.household_id, v_sale.id);
      
      RETURN QUERY SELECT v_sale.id, v_match.household_id, v_match.match_confidence, 'linked'::text;
    ELSE
      RETURN QUERY SELECT v_sale.id, NULL::uuid, NULL::text, 'no_match'::text;
    END IF;
  END LOOP;
END;
$$;

-- Also fix trigger_auto_match_sale_to_lqs if it has the same issue
CREATE OR REPLACE FUNCTION public.trigger_auto_match_sale_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
BEGIN
  -- Only process if this is a new sale
  IF TG_OP = 'INSERT' THEN
    -- Try to find a matching household
    SELECT * INTO v_match
    FROM match_sale_to_lqs_household(NEW.id)
    LIMIT 1;
    
    IF FOUND AND v_match.household_id IS NOT NULL THEN
      -- FIX: Correct parameter order (household_id first, sale_id second)
      PERFORM link_sale_to_lqs_household(v_match.household_id, NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;