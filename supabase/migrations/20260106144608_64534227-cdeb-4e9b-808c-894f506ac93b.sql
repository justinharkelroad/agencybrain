-- Phase 5: Auto-Matching & Sales Integration

-- Step 1: Add sold_date column to lqs_households
ALTER TABLE lqs_households 
ADD COLUMN IF NOT EXISTS sold_date date;

COMMENT ON COLUMN lqs_households.sold_date IS 'Date when household was marked as sold';

-- Step 2: Function to match a sale to an LQS household
CREATE OR REPLACE FUNCTION public.match_sale_to_lqs_household(
  p_sale_id uuid
) RETURNS TABLE(
  household_id uuid,
  match_confidence text,
  matched_key text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_last_name text;
  v_first_name text;
  v_household_key text;
  v_household_id uuid;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Parse customer_name: "HELEN J MAZZITELLI" -> last = "MAZZITELLI", first = "HELEN"
  -- Strategy: Last word is last name, first word is first name
  v_last_name := UPPER(TRIM(SPLIT_PART(v_sale.customer_name, ' ', 
    array_length(string_to_array(v_sale.customer_name, ' '), 1))));
  v_first_name := UPPER(TRIM(SPLIT_PART(v_sale.customer_name, ' ', 1)));
  
  -- Clean special characters
  v_last_name := REGEXP_REPLACE(v_last_name, '[^A-Z]', '', 'g');
  v_first_name := REGEXP_REPLACE(v_first_name, '[^A-Z]', '', 'g');
  
  -- Generate household key
  v_household_key := v_last_name || '_' || v_first_name || '_' || COALESCE(v_sale.customer_zip, '');
  
  -- Look for exact match
  SELECT h.id INTO v_household_id
  FROM lqs_households h
  WHERE h.household_key = v_household_key
    AND h.agency_id = v_sale.agency_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_household_id, 'exact'::text, v_household_key;
    RETURN;
  END IF;
  
  -- Fuzzy match: last name + first initial + ZIP
  SELECT h.id INTO v_household_id
  FROM lqs_households h
  WHERE UPPER(h.last_name) = v_last_name
    AND LEFT(UPPER(h.first_name), 1) = LEFT(v_first_name, 1)
    AND h.zip_code = v_sale.customer_zip
    AND h.agency_id = v_sale.agency_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_household_id, 'fuzzy'::text, v_household_key;
    RETURN;
  END IF;
  
  -- No match found
  RETURN;
END;
$$;

-- Step 3: Function to create lqs_sales record and update household status
CREATE OR REPLACE FUNCTION public.link_sale_to_lqs_household(
  p_sale_id uuid,
  p_household_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_policy RECORD;
  v_quote_id uuid;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found: %', p_sale_id;
  END IF;
  
  -- Update household status
  UPDATE lqs_households
  SET status = 'sold',
      sold_date = v_sale.sale_date,
      needs_attention = false,
      updated_at = now()
  WHERE id = p_household_id;
  
  -- Create lqs_sales records for each policy
  FOR v_policy IN 
    SELECT * FROM sale_policies WHERE sale_id = p_sale_id
  LOOP
    -- Try to match to a quote by product type
    SELECT q.id INTO v_quote_id
    FROM lqs_quotes q
    WHERE q.household_id = p_household_id
      AND UPPER(q.product_type) = UPPER(v_policy.policy_type_name)
    LIMIT 1;
    
    -- Insert lqs_sales record (skip if already exists)
    INSERT INTO lqs_sales (
      household_id,
      agency_id,
      team_member_id,
      sale_date,
      product_type,
      items_sold,
      policies_sold,
      premium_cents,
      policy_number,
      source,
      source_reference_id,
      linked_quote_id
    ) 
    SELECT
      p_household_id,
      v_sale.agency_id,
      v_sale.team_member_id,
      v_sale.sale_date,
      v_policy.policy_type_name,
      COALESCE(v_policy.total_items, 1),
      1,
      COALESCE((v_policy.total_premium * 100)::integer, 0),
      v_policy.policy_number,
      'sales_dashboard',
      p_sale_id,
      v_quote_id
    WHERE NOT EXISTS (
      SELECT 1 FROM lqs_sales ls 
      WHERE ls.source_reference_id = p_sale_id 
        AND ls.product_type = v_policy.policy_type_name
    );
  END LOOP;
END;
$$;

-- Step 4: One-time backfill function
CREATE OR REPLACE FUNCTION public.backfill_lqs_sales_matching(
  p_agency_id uuid
) RETURNS TABLE(
  sale_id uuid,
  matched_household_id uuid,
  match_confidence text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        WHERE ls.source_reference_id = s.id
      )
  LOOP
    -- Try to match
    SELECT * INTO v_match 
    FROM match_sale_to_lqs_household(v_sale.id)
    LIMIT 1;
    
    IF FOUND AND v_match.household_id IS NOT NULL THEN
      -- Link the sale
      PERFORM link_sale_to_lqs_household(v_sale.id, v_match.household_id);
      
      RETURN QUERY SELECT v_sale.id, v_match.household_id, v_match.match_confidence, 'linked'::text;
    ELSE
      RETURN QUERY SELECT v_sale.id, NULL::uuid, NULL::text, 'no_match'::text;
    END IF;
  END LOOP;
END;
$$;