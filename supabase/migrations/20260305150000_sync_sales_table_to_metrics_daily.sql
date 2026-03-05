-- Sync sales → metrics_daily so the dashboard rings reflect
-- sales entered via AddSaleForm / StaffAddSaleForm (which write
-- directly to `sales`, bypassing `lqs_sales`).
-- Uses GREATEST(COALESCE(..., 0), ...) so scorecard submissions and LQS triggers coexist.

-- Part 1: Trigger function (outer — dispatches to helper)
CREATE OR REPLACE FUNCTION sync_sales_to_metrics_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_team_member_id UUID;
  v_sale_date DATE;
  v_agency_id UUID;
BEGIN
  -- Determine affected team member + date
  IF TG_OP = 'DELETE' THEN
    v_team_member_id := OLD.team_member_id;
    v_sale_date := OLD.sale_date;
    v_agency_id := OLD.agency_id;
  ELSE
    v_team_member_id := NEW.team_member_id;
    v_sale_date := NEW.sale_date;
    v_agency_id := NEW.agency_id;
  END IF;

  -- On UPDATE, if team_member or date changed, recalc the OLD combination too
  IF TG_OP = 'UPDATE' THEN
    IF OLD.team_member_id IS DISTINCT FROM NEW.team_member_id
       OR OLD.sale_date IS DISTINCT FROM NEW.sale_date THEN
      IF OLD.team_member_id IS NOT NULL AND OLD.sale_date IS NOT NULL THEN
        PERFORM sync_sales_metrics_for_member(OLD.agency_id, OLD.team_member_id, OLD.sale_date);
      END IF;
    END IF;
  END IF;

  -- metrics_daily.team_member_id is NOT NULL; skip unmatched rows
  IF v_team_member_id IS NULL OR v_sale_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM sync_sales_metrics_for_member(v_agency_id, v_team_member_id, v_sale_date);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Part 2: Helper that does the actual aggregation + upsert
CREATE OR REPLACE FUNCTION sync_sales_metrics_for_member(
  p_agency_id UUID,
  p_team_member_id UUID,
  p_sale_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_role app_member_role;
  v_items INT;
  v_policies INT;
  v_premium_cents BIGINT;
  v_kpi_version_id uuid;
  v_label text;
BEGIN
  -- Aggregate all sales for this member on this date
  SELECT
    COALESCE(SUM(s.total_items), 0),
    COALESCE(SUM(s.total_policies), 0),
    COALESCE(SUM(ROUND(s.total_premium * 100))::bigint, 0)
  INTO v_items, v_policies, v_premium_cents
  FROM sales s
  WHERE s.team_member_id = p_team_member_id
    AND s.sale_date = p_sale_date
    AND s.agency_id = p_agency_id;

  -- Look up role
  SELECT role INTO v_role FROM team_members WHERE id = p_team_member_id;

  -- Lookup kpi_version for CHECK constraint (required for new rows)
  SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = p_agency_id AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC LIMIT 1;

  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = p_agency_id AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'sync_sales_metrics: No kpi_version for agency=%, skipping', p_agency_id;
    RETURN;
  END IF;

  -- Upsert into metrics_daily (COALESCE guards against NULL columns)
  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    sold_items, sold_policies, sold_premium_cents,
    kpi_version_id, label_at_submit
  )
  VALUES (
    p_agency_id, p_team_member_id, p_sale_date,
    COALESCE(v_role, 'Sales'),
    v_items, v_policies, v_premium_cents,
    v_kpi_version_id, v_label
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    sold_items         = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),
    sold_policies      = GREATEST(COALESCE(metrics_daily.sold_policies, 0), EXCLUDED.sold_policies),
    sold_premium_cents = GREATEST(COALESCE(metrics_daily.sold_premium_cents, 0), EXCLUDED.sold_premium_cents),
    updated_at         = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Part 2b: Lock down the helper — only trigger context should call it
REVOKE EXECUTE ON FUNCTION sync_sales_metrics_for_member(UUID, UUID, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sync_sales_to_metrics_daily() FROM PUBLIC;

-- Part 3: Register trigger on sales table
CREATE TRIGGER trg_sync_sales_to_metrics
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION sync_sales_to_metrics_daily();

-- Part 4: Fix pre-existing COALESCE bug in the lqs_sales trigger
-- (migration 20260206110000 used GREATEST without COALESCE — NULL columns silently lose updates)
CREATE OR REPLACE FUNCTION sync_lqs_sales_to_metrics_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_team_member_id UUID;
  v_sale_date DATE;
  v_agency_id UUID;
  v_role app_member_role;
  v_items INT;
  v_policies INT;
  v_premium BIGINT;
  v_kpi_version_id uuid;
  v_label text;
BEGIN
  -- Determine affected team member + date
  IF TG_OP = 'DELETE' THEN
    v_team_member_id := OLD.team_member_id;
    v_sale_date := OLD.sale_date;
    v_agency_id := OLD.agency_id;
  ELSE
    v_team_member_id := NEW.team_member_id;
    v_sale_date := NEW.sale_date;
    v_agency_id := NEW.agency_id;
  END IF;

  -- metrics_daily.team_member_id is NOT NULL; skip unmatched rows
  IF v_team_member_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Aggregate all sales for this member on this date
  SELECT
    COALESCE(SUM(items_sold), 0),
    COALESCE(SUM(policies_sold), 0),
    COALESCE(SUM(premium_cents), 0)
  INTO v_items, v_policies, v_premium
  FROM lqs_sales
  WHERE team_member_id = v_team_member_id
    AND sale_date = v_sale_date;

  -- Look up role
  SELECT role INTO v_role FROM team_members WHERE id = v_team_member_id;

  -- Lookup kpi_version for CHECK constraint (required for new rows)
  SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = v_agency_id AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC LIMIT 1;

  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = v_agency_id AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'sync_lqs_sales: No kpi_version for agency=%, skipping', v_agency_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert into metrics_daily (COALESCE guards against NULL columns)
  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    sold_items, sold_policies, sold_premium_cents,
    kpi_version_id, label_at_submit
  )
  VALUES (
    v_agency_id, v_team_member_id, v_sale_date,
    COALESCE(v_role, 'Sales'),
    v_items, v_policies, v_premium,
    v_kpi_version_id, v_label
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    sold_items         = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),
    sold_policies      = GREATEST(COALESCE(metrics_daily.sold_policies, 0), EXCLUDED.sold_policies),
    sold_premium_cents = GREATEST(COALESCE(metrics_daily.sold_premium_cents, 0), EXCLUDED.sold_premium_cents),
    updated_at         = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Part 5: Backfill — update existing metrics_daily rows from sales table
UPDATE metrics_daily md
SET
  sold_items         = GREATEST(COALESCE(md.sold_items, 0), agg.total_items),
  sold_policies      = GREATEST(COALESCE(md.sold_policies, 0), agg.total_policies),
  sold_premium_cents = GREATEST(COALESCE(md.sold_premium_cents, 0), agg.total_premium_cents),
  updated_at         = now()
FROM (
  SELECT
    s.agency_id,
    s.team_member_id,
    s.sale_date,
    COALESCE(SUM(s.total_items), 0)::int AS total_items,
    COALESCE(SUM(s.total_policies), 0)::int AS total_policies,
    COALESCE(SUM(ROUND(s.total_premium * 100)), 0)::bigint AS total_premium_cents
  FROM sales s
  WHERE s.team_member_id IS NOT NULL
    AND s.sale_date IS NOT NULL
  GROUP BY s.agency_id, s.team_member_id, s.sale_date
) agg
WHERE agg.team_member_id = md.team_member_id
  AND agg.sale_date = md.date;

-- Part 6: Insert metrics_daily rows for sales that have no existing row.
INSERT INTO metrics_daily (
  agency_id, team_member_id, date, role,
  sold_items, sold_policies, sold_premium_cents,
  kpi_version_id, label_at_submit
)
SELECT
  agg.agency_id,
  agg.team_member_id,
  agg.sale_date,
  COALESCE(tm.role, 'Sales'),
  agg.total_items,
  agg.total_policies,
  agg.total_premium_cents,
  kv_lookup.kpi_version_id,
  kv_lookup.label
FROM (
  SELECT
    s.agency_id,
    s.team_member_id,
    s.sale_date,
    COALESCE(SUM(s.total_items), 0)::int AS total_items,
    COALESCE(SUM(s.total_policies), 0)::int AS total_policies,
    COALESCE(SUM(ROUND(s.total_premium * 100)), 0)::bigint AS total_premium_cents
  FROM sales s
  WHERE s.team_member_id IS NOT NULL
    AND s.sale_date IS NOT NULL
  GROUP BY s.agency_id, s.team_member_id, s.sale_date
) agg
LEFT JOIN team_members tm ON tm.id = agg.team_member_id
LEFT JOIN LATERAL (
  SELECT kv.id AS kpi_version_id, kv.label
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = agg.agency_id AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1
) kv_lookup ON true
WHERE kv_lookup.kpi_version_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM metrics_daily md
    WHERE md.team_member_id = agg.team_member_id
      AND md.date = agg.sale_date
  )
ON CONFLICT (team_member_id, date) DO NOTHING;
