-- Fix: aggregate from sale_policies (source of truth) instead of sales.total_items
-- which can be stale if a sale is edited after creation.
-- Also add trigger on sale_policies so metrics update when policies are added/removed.

-- Part 1: Update the helper to aggregate from sale_policies via sales JOIN
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
  -- Aggregate from sale_policies (source of truth), not sales.total_items
  SELECT
    COALESCE(SUM(sp.total_items), 0),
    COALESCE(COUNT(sp.id), 0),
    COALESCE(SUM(ROUND(sp.total_premium * 100))::bigint, 0)
  INTO v_items, v_policies, v_premium_cents
  FROM sale_policies sp
  JOIN sales s ON s.id = sp.sale_id
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

-- Part 2: Trigger function for sale_policies — resolves sale context and dispatches
CREATE OR REPLACE FUNCTION sync_sale_policies_to_metrics_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id UUID;
  v_team_member_id UUID;
  v_sale_date DATE;
  v_agency_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;

  -- Look up the parent sale to get team_member, date, agency
  SELECT team_member_id, sale_date, agency_id
  INTO v_team_member_id, v_sale_date, v_agency_id
  FROM sales
  WHERE id = v_sale_id;

  IF v_team_member_id IS NULL OR v_sale_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM sync_sales_metrics_for_member(v_agency_id, v_team_member_id, v_sale_date);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

REVOKE EXECUTE ON FUNCTION sync_sale_policies_to_metrics_daily() FROM PUBLIC;

-- Part 3: Register trigger on sale_policies
CREATE TRIGGER trg_sync_sale_policies_to_metrics
  AFTER INSERT OR UPDATE OR DELETE ON sale_policies
  FOR EACH ROW
  EXECUTE FUNCTION sync_sale_policies_to_metrics_daily();

-- Part 4: Backfill — re-sync from sale_policies (corrects any stale sales.total_items)
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
    COALESCE(SUM(sp.total_items), 0)::int AS total_items,
    COUNT(sp.id)::int AS total_policies,
    COALESCE(SUM(ROUND(sp.total_premium * 100)), 0)::bigint AS total_premium_cents
  FROM sale_policies sp
  JOIN sales s ON s.id = sp.sale_id
  WHERE s.team_member_id IS NOT NULL
    AND s.sale_date IS NOT NULL
  GROUP BY s.agency_id, s.team_member_id, s.sale_date
) agg
WHERE agg.team_member_id = md.team_member_id
  AND agg.sale_date = md.date;
