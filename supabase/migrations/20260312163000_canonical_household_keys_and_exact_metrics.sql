-- Canonicalize household-key generation across active write paths and
-- replace upward-only metrics reconciliation with exact recomputation.

CREATE OR REPLACE FUNCTION public.generate_household_key(
  p_first_name TEXT,
  p_last_name TEXT,
  p_zip_code TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(REGEXP_REPLACE(COALESCE(p_last_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
         UPPER(REGEXP_REPLACE(COALESCE(p_first_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
         COALESCE(NULLIF(LEFT(TRIM(COALESCE(p_zip_code, '')), 5), ''), '00000');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


CREATE OR REPLACE FUNCTION public.sync_exact_quoted_metrics_for_member(
  p_agency_id UUID,
  p_team_member_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_member_role;
  v_quoted_count INT := 0;
  v_kpi_version_id UUID;
  v_label TEXT;
  v_updated_count INT := 0;
BEGIN
  IF p_team_member_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_quoted_count
  FROM public.lqs_households h
  WHERE h.agency_id = p_agency_id
    AND h.team_member_id = p_team_member_id
    AND h.first_quote_date = p_date
    AND h.status IN ('quoted', 'sold');

  UPDATE public.metrics_daily
  SET
    quoted_count = v_quoted_count,
    updated_at = now()
  WHERE team_member_id = p_team_member_id
    AND date = p_date;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count > 0 THEN
    RETURN;
  END IF;

  IF v_quoted_count = 0 THEN
    RETURN;
  END IF;

  SELECT role
  INTO v_role
  FROM public.team_members
  WHERE id = p_team_member_id;

  SELECT kv.id, kv.label
  INTO v_kpi_version_id, v_label
  FROM public.kpi_versions kv
  JOIN public.kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = p_agency_id
    AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label
    INTO v_kpi_version_id, v_label
    FROM public.forms_kpi_bindings fb
    JOIN public.kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN public.form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = p_agency_id
      AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC
    LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.metrics_daily (
    agency_id,
    team_member_id,
    date,
    quoted_count,
    role,
    kpi_version_id,
    label_at_submit
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_date,
    v_quoted_count,
    COALESCE(v_role, 'Sales'),
    v_kpi_version_id,
    v_label
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    quoted_count = EXCLUDED.quoted_count,
    updated_at = now();
END;
$$;


CREATE OR REPLACE FUNCTION public.increment_metrics_quoted_count(
  p_agency_id UUID,
  p_team_member_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_exact_quoted_metrics_for_member(
    p_agency_id,
    p_team_member_id,
    p_date
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.increment_quoted_count_from_lqs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qualifies BOOLEAN := FALSE;
  v_new_qualifies BOOLEAN := FALSE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_qualifies := OLD.team_member_id IS NOT NULL
      AND OLD.first_quote_date IS NOT NULL
      AND OLD.status IN ('quoted', 'sold');
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_qualifies := NEW.team_member_id IS NOT NULL
      AND NEW.first_quote_date IS NOT NULL
      AND NEW.status IN ('quoted', 'sold');
  END IF;

  IF v_old_qualifies AND (
    TG_OP = 'DELETE'
    OR NOT v_new_qualifies
    OR OLD.team_member_id IS DISTINCT FROM NEW.team_member_id
    OR OLD.first_quote_date IS DISTINCT FROM NEW.first_quote_date
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    PERFORM public.sync_exact_quoted_metrics_for_member(
      OLD.agency_id,
      OLD.team_member_id,
      OLD.first_quote_date
    );
  END IF;

  IF v_new_qualifies THEN
    PERFORM public.sync_exact_quoted_metrics_for_member(
      NEW.agency_id,
      NEW.team_member_id,
      NEW.first_quote_date
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


DROP TRIGGER IF EXISTS lqs_households_update_metrics ON public.lqs_households;

CREATE TRIGGER lqs_households_update_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.lqs_households
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_quoted_count_from_lqs();


CREATE OR REPLACE FUNCTION public.sync_sold_metrics_for_member(
  p_agency_id UUID,
  p_team_member_id UUID,
  p_sale_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_member_role;
  v_sales_items INT := 0;
  v_sales_policies INT := 0;
  v_sales_premium_cents BIGINT := 0;
  v_lqs_items INT := 0;
  v_lqs_policies INT := 0;
  v_lqs_premium_cents BIGINT := 0;
  v_items INT := 0;
  v_policies INT := 0;
  v_premium_cents BIGINT := 0;
  v_kpi_version_id UUID;
  v_label TEXT;
  v_updated_count INT := 0;
BEGIN
  IF p_team_member_id IS NULL OR p_sale_date IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(s.total_items), 0),
    COALESCE(SUM(s.total_policies), 0),
    COALESCE(SUM(ROUND(s.total_premium * 100))::bigint, 0)
  INTO v_sales_items, v_sales_policies, v_sales_premium_cents
  FROM public.sales s
  WHERE s.agency_id = p_agency_id
    AND s.team_member_id = p_team_member_id
    AND s.sale_date = p_sale_date;

  SELECT
    COALESCE(SUM(ls.items_sold), 0),
    COALESCE(SUM(ls.policies_sold), 0),
    COALESCE(SUM(ls.premium_cents), 0)
  INTO v_lqs_items, v_lqs_policies, v_lqs_premium_cents
  FROM public.lqs_sales ls
  WHERE ls.agency_id = p_agency_id
    AND ls.team_member_id = p_team_member_id
    AND ls.sale_date = p_sale_date;

  v_items := GREATEST(v_sales_items, v_lqs_items);
  v_policies := GREATEST(v_sales_policies, v_lqs_policies);
  v_premium_cents := GREATEST(v_sales_premium_cents, v_lqs_premium_cents);

  UPDATE public.metrics_daily
  SET
    sold_items = v_items,
    sold_policies = v_policies,
    sold_premium_cents = v_premium_cents,
    updated_at = now()
  WHERE team_member_id = p_team_member_id
    AND date = p_sale_date;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count > 0 THEN
    RETURN;
  END IF;

  IF v_items = 0 AND v_policies = 0 AND v_premium_cents = 0 THEN
    RETURN;
  END IF;

  SELECT role
  INTO v_role
  FROM public.team_members
  WHERE id = p_team_member_id;

  SELECT kv.id, kv.label
  INTO v_kpi_version_id, v_label
  FROM public.kpi_versions kv
  JOIN public.kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = p_agency_id
    AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label
    INTO v_kpi_version_id, v_label
    FROM public.forms_kpi_bindings fb
    JOIN public.kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN public.form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = p_agency_id
      AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC
    LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.metrics_daily (
    agency_id,
    team_member_id,
    date,
    role,
    sold_items,
    sold_policies,
    sold_premium_cents,
    kpi_version_id,
    label_at_submit
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_sale_date,
    COALESCE(v_role, 'Sales'),
    v_items,
    v_policies,
    v_premium_cents,
    v_kpi_version_id,
    v_label
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    sold_items = EXCLUDED.sold_items,
    sold_policies = EXCLUDED.sold_policies,
    sold_premium_cents = EXCLUDED.sold_premium_cents,
    updated_at = now();
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_sales_metrics_for_member(
  p_agency_id UUID,
  p_team_member_id UUID,
  p_sale_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_sold_metrics_for_member(
    p_agency_id,
    p_team_member_id,
    p_sale_date
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_sales_to_metrics_daily()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_member_id UUID;
  v_sale_date DATE;
  v_agency_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_team_member_id := OLD.team_member_id;
    v_sale_date := OLD.sale_date;
    v_agency_id := OLD.agency_id;
  ELSE
    v_team_member_id := NEW.team_member_id;
    v_sale_date := NEW.sale_date;
    v_agency_id := NEW.agency_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.team_member_id IS DISTINCT FROM NEW.team_member_id
       OR OLD.sale_date IS DISTINCT FROM NEW.sale_date THEN
      PERFORM public.sync_sold_metrics_for_member(
        OLD.agency_id,
        OLD.team_member_id,
        OLD.sale_date
      );
    END IF;
  END IF;

  PERFORM public.sync_sold_metrics_for_member(
    v_agency_id,
    v_team_member_id,
    v_sale_date
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_lqs_sales_to_metrics_daily()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_member_id UUID;
  v_sale_date DATE;
  v_agency_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_team_member_id := OLD.team_member_id;
    v_sale_date := OLD.sale_date;
    v_agency_id := OLD.agency_id;
  ELSE
    v_team_member_id := NEW.team_member_id;
    v_sale_date := NEW.sale_date;
    v_agency_id := NEW.agency_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.team_member_id IS DISTINCT FROM NEW.team_member_id
       OR OLD.sale_date IS DISTINCT FROM NEW.sale_date THEN
      PERFORM public.sync_sold_metrics_for_member(
        OLD.agency_id,
        OLD.team_member_id,
        OLD.sale_date
      );
    END IF;
  END IF;

  PERFORM public.sync_sold_metrics_for_member(
    v_agency_id,
    v_team_member_id,
    v_sale_date
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


CREATE OR REPLACE FUNCTION public.sync_quoted_household_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_key TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_lead_source_id UUID;
  v_space_pos INT;
  v_normalized_zip TEXT;
BEGIN
  v_normalized_zip := NULLIF(LEFT(TRIM(COALESCE(NEW.zip_code, '')), 5), '');

  IF v_normalized_zip IS NULL THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no zip_code for detail=%, household=%',
      NEW.id, NEW.household_name;
    RETURN NEW;
  END IF;

  IF NEW.household_name IS NULL OR TRIM(NEW.household_name) = '' THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no household_name for detail=%',
      NEW.id;
    RETURN NEW;
  END IF;

  v_space_pos := POSITION(' ' IN TRIM(NEW.household_name));

  IF v_space_pos > 0 THEN
    v_first_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM 1 FOR v_space_pos - 1));
    v_last_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM v_space_pos + 1));
    IF v_last_name = '' THEN
      v_last_name := v_first_name;
      v_first_name := 'Unknown';
    END IF;
  ELSE
    v_last_name := TRIM(NEW.household_name);
    v_first_name := 'Unknown';
  END IF;

  v_first_name := REGEXP_REPLACE(v_first_name, '[^a-zA-Z]', '', 'g');
  v_last_name := REGEXP_REPLACE(v_last_name, '[^a-zA-Z]', '', 'g');

  IF v_first_name = '' THEN v_first_name := 'Unknown'; END IF;
  IF v_last_name = '' THEN v_last_name := 'Unknown'; END IF;

  v_household_key := public.generate_household_key(v_first_name, v_last_name, v_normalized_zip);

  IF NEW.lead_source_label IS NOT NULL AND NEW.lead_source_label != '' THEN
    SELECT id INTO v_lead_source_id
    FROM public.lead_sources
    WHERE agency_id = NEW.agency_id
      AND name = NEW.lead_source_label
    LIMIT 1;
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.lqs_households
  WHERE agency_id = NEW.agency_id
    AND household_key = v_household_key;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.lqs_households
    SET
      updated_at = now(),
      status = CASE
        WHEN public.lqs_households.status = 'lead' THEN 'quoted'
        ELSE public.lqs_households.status
      END,
      first_quote_date = CASE
        WHEN public.lqs_households.status = 'lead' AND public.lqs_households.first_quote_date IS NULL
        THEN NEW.work_date
        ELSE public.lqs_households.first_quote_date
      END,
      lead_source_id = COALESCE(public.lqs_households.lead_source_id, v_lead_source_id),
      team_member_id = COALESCE(public.lqs_households.team_member_id, NEW.team_member_id),
      needs_attention = CASE
        WHEN v_lead_source_id IS NOT NULL THEN false
        ELSE public.lqs_households.needs_attention
      END,
      zip_code = COALESCE(public.lqs_households.zip_code, v_normalized_zip)
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.lqs_households (
      agency_id,
      household_key,
      first_name,
      last_name,
      zip_code,
      status,
      team_member_id,
      first_quote_date,
      lead_source_id,
      needs_attention,
      skip_metrics_increment
    )
    VALUES (
      NEW.agency_id,
      v_household_key,
      INITCAP(v_first_name),
      INITCAP(v_last_name),
      v_normalized_zip,
      'quoted',
      NEW.team_member_id,
      NEW.work_date,
      v_lead_source_id,
      (v_lead_source_id IS NULL),
      true
    );

    SELECT id INTO v_existing_id
    FROM public.lqs_households
    WHERE agency_id = NEW.agency_id
      AND household_key = v_household_key;
  END IF;

  INSERT INTO public.lqs_quotes (
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
  VALUES (
    v_existing_id,
    NEW.agency_id,
    NEW.team_member_id,
    NEW.work_date,
    'Bundle',
    COALESCE(NEW.items_quoted, 1),
    COALESCE(NEW.premium_potential_cents, 0),
    'scorecard',
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


DO $$
DECLARE
  v_metric_row RECORD;
  v_quote_row RECORD;
  v_sale_row RECORD;
BEGIN
  FOR v_metric_row IN
    SELECT DISTINCT agency_id, team_member_id, date
    FROM public.metrics_daily
    WHERE team_member_id IS NOT NULL
      AND date IS NOT NULL
  LOOP
    PERFORM public.sync_exact_quoted_metrics_for_member(
      v_metric_row.agency_id,
      v_metric_row.team_member_id,
      v_metric_row.date
    );

    PERFORM public.sync_sold_metrics_for_member(
      v_metric_row.agency_id,
      v_metric_row.team_member_id,
      v_metric_row.date
    );
  END LOOP;

  FOR v_quote_row IN
    SELECT DISTINCT agency_id, team_member_id, first_quote_date AS work_date
    FROM public.lqs_households
    WHERE team_member_id IS NOT NULL
      AND first_quote_date IS NOT NULL
  LOOP
    PERFORM public.sync_exact_quoted_metrics_for_member(
      v_quote_row.agency_id,
      v_quote_row.team_member_id,
      v_quote_row.work_date
    );
  END LOOP;

  FOR v_sale_row IN
    SELECT DISTINCT agency_id, team_member_id, sale_date
    FROM (
      SELECT agency_id, team_member_id, sale_date
      FROM public.sales
      WHERE team_member_id IS NOT NULL
        AND sale_date IS NOT NULL
      UNION
      SELECT agency_id, team_member_id, sale_date
      FROM public.lqs_sales
      WHERE team_member_id IS NOT NULL
        AND sale_date IS NOT NULL
    ) combined_sales
  LOOP
    PERFORM public.sync_sold_metrics_for_member(
      v_sale_row.agency_id,
      v_sale_row.team_member_id,
      v_sale_row.sale_date
    );
  END LOOP;
END;
$$;
