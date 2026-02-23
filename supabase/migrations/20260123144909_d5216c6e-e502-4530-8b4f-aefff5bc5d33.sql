DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL
    OR to_regclass('public.agency_contacts') IS NULL
    OR to_regclass('public.lqs_households') IS NULL
    OR to_regclass('public.lqs_quotes') IS NULL
    OR to_regclass('public.lqs_sales') IS NULL THEN
    RAISE NOTICE 'Skipping % because required source tables do not exist.', '20260123144909_d5216c6e-e502-4530-8b4f-aefff5bc5d33';
    RETURN;
  END IF;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION sync_sale_to_lqs()
RETURNS TRIGGER AS $function$
DECLARE
  v_household_id UUID;
  v_household_key TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_zip_code TEXT;
BEGIN
  -- Skip if no contact
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get contact info for household key
  SELECT
    COALESCE(first_name, ''),
    COALESCE(last_name, ''),
    COALESCE(zip_code, '')
  INTO v_first_name, v_last_name, v_zip_code
  FROM agency_contacts
  WHERE id = NEW.contact_id;

  -- Generate household key
  v_household_key := LOWER(TRIM(v_first_name)) || '_' || LOWER(TRIM(v_last_name)) || '_' || COALESCE(v_zip_code, '');

  -- Upsert lqs_household with all dates set (one-call close assumption)
  INSERT INTO lqs_households (
    agency_id,
    household_key,
    first_name,
    last_name,
    zip_code,
    contact_id,
    status,
    lead_received_date,
    first_quote_date,
    sold_date,
    team_member_id,
    needs_attention
  ) VALUES (
    NEW.agency_id,
    v_household_key,
    v_first_name,
    v_last_name,
    v_zip_code,
    NEW.contact_id,
    'sold',
    NEW.sale_date,
    NEW.sale_date,
    NEW.sale_date,
    NEW.team_member_id,
    false
  )
  ON CONFLICT (agency_id, household_key) DO UPDATE SET
    status = 'sold',
    lead_received_date = COALESCE(lqs_households.lead_received_date, EXCLUDED.lead_received_date),
    first_quote_date = COALESCE(lqs_households.first_quote_date, EXCLUDED.first_quote_date),
    sold_date = COALESCE(lqs_households.sold_date, EXCLUDED.sold_date),
    team_member_id = COALESCE(EXCLUDED.team_member_id, lqs_households.team_member_id),
    updated_at = NOW()
  RETURNING id INTO v_household_id;

  -- Create lqs_quotes record (1 per household/sale, aggregated totals)
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
  ) VALUES (
    v_household_id,
    NEW.agency_id,
    NEW.team_member_id,
    NEW.sale_date,
    'Multi-Line',
    COALESCE(NEW.total_items, 1),
    COALESCE((NEW.total_premium * 100)::integer, 0),
    'manual',
    NEW.id
  );

  -- Create lqs_sales record (1 per household/sale, aggregated totals)
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
  ) VALUES (
    v_household_id,
    NEW.agency_id,
    NEW.team_member_id,
    NEW.sale_date,
    'Multi-Line',
    COALESCE(NEW.total_items, 1),
    COALESCE(NEW.total_policies, 1),
    COALESCE((NEW.total_premium * 100)::integer, 0),
    'sales_dashboard',
    NEW.id
  );

  RETURN NEW;
END;
$function$
LANGUAGE plpgsql SECURITY DEFINER
$fn$;

  EXECUTE $sql$
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
    AND q.source_reference_id = s.id
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
    AND ls.source_reference_id = s.id
);
$sql$;
END $$;
