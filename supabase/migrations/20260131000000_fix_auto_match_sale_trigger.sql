-- Fix the auto-match trigger function to use sale_id instead of id
-- when triggered from sale_policies table

CREATE OR REPLACE FUNCTION public.trigger_auto_match_sale_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_sale_id uuid;
BEGIN
  -- Only process if this is a new sale_policy
  IF TG_OP = 'INSERT' THEN
    -- Get the sale_id from the sale_policies record
    v_sale_id := NEW.sale_id;
    
    -- Check if we've already processed this sale (avoid duplicate processing for multi-policy sales)
    IF EXISTS (
      SELECT 1 FROM lqs_sales ls 
      WHERE ls.source_reference_id = v_sale_id
    ) THEN
      RETURN NEW;
    END IF;
    
    -- Try to find a matching household
    SELECT * INTO v_match
    FROM match_sale_to_lqs_household(v_sale_id)
    LIMIT 1;
    
    IF FOUND AND v_match.household_id IS NOT NULL THEN
      -- Link the sale to the LQS household (this updates status to 'sold')
      PERFORM link_sale_to_lqs_household(v_match.household_id, v_sale_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also fix the parameter order in link_sale_to_lqs_household call
-- (the function signature is: p_household_id uuid, p_sale_id uuid)
-- Current call is correct, just documenting for clarity
