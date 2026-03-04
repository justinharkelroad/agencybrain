-- Fix: link_sale_to_lqs_household() never set first_quote_date when promoting
-- a household to 'sold'. This caused sold households to be invisible to the
-- Quoted Households metric (which filters on first_quote_date).
-- If you sold it, you had to quote it — so first_quote_date should always be set.

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

    -- Insert lqs_sales record (now includes is_one_call_close from parent sale)
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
      linked_quote_id,
      is_one_call_close
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
      v_quote_id,
      COALESCE(v_sale.is_one_call_close, false)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_lqs_sale_id;

    IF v_lqs_sale_id IS NOT NULL THEN
      v_policies_linked := v_policies_linked + 1;
    END IF;
  END LOOP;

  -- Update household status to sold and copy team_member_id.
  -- Set first_quote_date if not already set — if you sold it, you quoted it.
  UPDATE lqs_households
  SET status = 'sold',
      sold_date = v_sale.sale_date,
      first_quote_date = COALESCE(first_quote_date, v_sale.sale_date),
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

NOTIFY pgrst, 'reload schema';
