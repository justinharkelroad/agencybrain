-- Create product type normalization function
CREATE OR REPLACE FUNCTION normalize_product_type(p_product_type text)
RETURNS text AS $$
DECLARE
  v_upper text;
BEGIN
  IF p_product_type IS NULL OR TRIM(p_product_type) = '' THEN
    RETURN 'Unknown';
  END IF;

  v_upper := UPPER(TRIM(p_product_type));
  
  -- Auto variations
  IF v_upper IN ('AUTO', 'STANDARD AUTO', 'PERSONAL AUTO', 'SA') THEN
    RETURN 'Standard Auto';
  END IF;
  
  -- Home variations
  IF v_upper IN ('HOME', 'HOMEOWNERS', 'HOMEOWNER', 'HO') THEN
    RETURN 'Homeowners';
  END IF;
  
  -- Renters variations
  IF v_upper IN ('RENTER', 'RENTERS') THEN
    RETURN 'Renters';
  END IF;
  
  -- Landlords variations
  IF v_upper IN ('LANDLORD', 'LANDLORDS', 'LL') THEN
    RETURN 'Landlords';
  END IF;
  
  -- Umbrella variations
  IF v_upper IN ('UMBRELLA', 'PERSONAL UMBRELLA', 'PUP') THEN
    RETURN 'Personal Umbrella';
  END IF;
  
  -- Motor Club variations
  IF v_upper IN ('MOTOR CLUB', 'MOTORCLUB', 'MC') THEN
    RETURN 'Motor Club';
  END IF;
  
  -- Condo variations
  IF v_upper IN ('CONDO', 'CONDOMINIUM') THEN
    RETURN 'Condo';
  END IF;
  
  -- Mobilehome variations
  IF v_upper IN ('MOBILEHOME', 'MOBILE HOME', 'MH') THEN
    RETURN 'Mobilehome';
  END IF;
  
  -- Auto Special variations
  IF v_upper IN ('AUTO - SPECIAL', 'AUTO-SPECIAL', 'SPECIAL AUTO', 'NON-STANDARD AUTO') THEN
    RETURN 'Auto - Special';
  END IF;
  
  -- If no match, return original with title case
  RETURN INITCAP(p_product_type);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Update link_sale_to_lqs_household to use normalization for quote matching
CREATE OR REPLACE FUNCTION link_sale_to_lqs_household(
  p_household_id UUID,
  p_sale_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_policy RECORD;
  v_quote_id UUID;
  v_lqs_sale_id UUID;
  v_policies_linked INT := 0;
BEGIN
  -- Get the sale details
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  IF v_sale IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;
  
  -- Process each policy from sale_policies
  FOR v_policy IN 
    SELECT * FROM sale_policies WHERE sale_id = p_sale_id
  LOOP
    -- Try to match to a quote by NORMALIZED product type
    SELECT q.id INTO v_quote_id
    FROM lqs_quotes q
    WHERE q.household_id = p_household_id
      AND normalize_product_type(q.product_type) = normalize_product_type(v_policy.policy_type_name)
    LIMIT 1;
    
    -- Insert lqs_sales record
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
      normalize_product_type(v_policy.policy_type_name),
      COALESCE(v_policy.total_items, 1),
      1,
      COALESCE((v_policy.total_premium * 100)::integer, 0),
      v_policy.policy_number,
      'sales_dashboard',
      p_sale_id,
      v_quote_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_lqs_sale_id;
    
    IF v_lqs_sale_id IS NOT NULL THEN
      v_policies_linked := v_policies_linked + 1;
    END IF;
  END LOOP;
  
  -- Update household status to sold and copy team_member_id
  UPDATE lqs_households
  SET status = 'sold',
      sold_date = v_sale.sale_date,
      needs_attention = false,
      lead_source_id = COALESCE(v_sale.lead_source_id, lead_source_id),
      team_member_id = COALESCE(v_sale.team_member_id, team_member_id),
      updated_at = now()
  WHERE id = p_household_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'policies_linked', v_policies_linked
  );
END;
$$;

-- Also update backfill function to use normalized matching (for quote linking within)
-- This ensures re-running backfill will properly match quotes to sales