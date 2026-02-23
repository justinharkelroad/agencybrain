DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL
    OR to_regclass('public.lqs_households') IS NULL
    OR to_regclass('public.lqs_quotes') IS NULL
    OR to_regclass('public.lqs_sales') IS NULL THEN
    RAISE NOTICE 'Skipping % because required source tables do not exist.', '20260123144949_9c380f48-2b2e-4751-b732-c58c3cf78e27';
    RETURN;
  END IF;

  UPDATE lqs_households h
  SET 
    lead_received_date = s.sale_date,
    first_quote_date = s.sale_date,
    sold_date = s.sale_date
  FROM sales s
  WHERE h.contact_id = s.contact_id 
    AND h.agency_id = s.agency_id
    AND (h.lead_received_date IS NULL OR h.first_quote_date IS NULL OR h.sold_date IS NULL);

  INSERT INTO lqs_quotes (
    household_id,
    agency_id,
    team_member_id,
    quote_date,
    product_type,
    items_quoted,
    premium_cents,
    source,
    source_reference_id
  )
  SELECT 
    h.id,
    s.agency_id,
    s.team_member_id,
    s.sale_date,
    'Multi-Line',
    COALESCE(s.total_items, 1),
    COALESCE((s.total_premium * 100)::integer, 0),
    'manual',
    s.id
  FROM sales s
  JOIN lqs_households h ON h.contact_id = s.contact_id AND h.agency_id = s.agency_id
  WHERE NOT EXISTS (
    SELECT 1 FROM lqs_quotes q 
    WHERE q.household_id = h.id
  );

  INSERT INTO lqs_sales (
    household_id,
    agency_id,
    team_member_id,
    sale_date,
    product_type,
    items_sold,
    policies_sold,
    premium_cents,
    source,
    source_reference_id
  )
  SELECT 
    h.id,
    s.agency_id,
    s.team_member_id,
    s.sale_date,
    'Multi-Line',
    COALESCE(s.total_items, 1),
    COALESCE(s.total_policies, 1),
    COALESCE((s.total_premium * 100)::integer, 0),
    'sales_dashboard',
    s.id
  FROM sales s
  JOIN lqs_households h ON h.contact_id = s.contact_id AND h.agency_id = s.agency_id
  WHERE NOT EXISTS (
    SELECT 1 FROM lqs_sales ls 
    WHERE ls.household_id = h.id
  );
END $$;
