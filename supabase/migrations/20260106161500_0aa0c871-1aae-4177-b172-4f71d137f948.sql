-- Update function to also copy lead_source_id from sale to household
CREATE OR REPLACE FUNCTION public.link_sale_to_lqs_household(
  p_sale_id uuid,
  p_household_id uuid
) RETURNS void AS $$
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
  
  -- Update household status AND lead_source_id (if sale has one)
  UPDATE lqs_households
  SET status = 'sold',
      sold_date = v_sale.sale_date,
      needs_attention = false,
      lead_source_id = COALESCE(v_sale.lead_source_id, lead_source_id),
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
      AND q.product_type = v_policy.policy_type_name
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
    ) VALUES (
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
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix Helen's household directly (update lead_source_id from her sale)
UPDATE lqs_households h
SET lead_source_id = s.lead_source_id,
    needs_attention = false,
    updated_at = now()
FROM sales s
WHERE s.customer_name ILIKE '%MAZZITELLI%'
  AND s.customer_zip = h.zip_code
  AND UPPER(h.last_name) = 'MAZZITELLI'
  AND s.lead_source_id IS NOT NULL;