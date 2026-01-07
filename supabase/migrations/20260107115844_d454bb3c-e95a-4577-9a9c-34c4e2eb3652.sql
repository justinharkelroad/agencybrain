-- Drop existing function first (different return type)
DROP FUNCTION IF EXISTS link_sale_to_lqs_household(uuid, uuid);

-- Recreate with team_member_id copy
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
  v_lqs_sale_id UUID;
BEGIN
  -- Get the sale details
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  IF v_sale IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale not found');
  END IF;
  
  -- Create lqs_sale record
  INSERT INTO lqs_sales (
    household_id,
    sale_date,
    policies,
    items,
    premium_cents,
    source,
    source_reference_id
  ) VALUES (
    p_household_id,
    v_sale.sale_date,
    v_sale.policies,
    v_sale.items,
    v_sale.premium,
    'sales_import',
    p_sale_id::text
  )
  RETURNING id INTO v_lqs_sale_id;
  
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
    'lqs_sale_id', v_lqs_sale_id,
    'household_id', p_household_id
  );
END;
$$;