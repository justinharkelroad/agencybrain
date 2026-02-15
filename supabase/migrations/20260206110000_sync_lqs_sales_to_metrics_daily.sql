-- Sync lqs_sales → metrics_daily so the dashboard
-- automatically surfaces Items Sold data from sales records.
-- Uses GREATEST() so scorecard submissions and sales uploads coexist.

-- Part 1: Trigger function
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

  -- Upsert into metrics_daily
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
    sold_items         = GREATEST(metrics_daily.sold_items, EXCLUDED.sold_items),
    sold_policies      = GREATEST(metrics_daily.sold_policies, EXCLUDED.sold_policies),
    sold_premium_cents = GREATEST(metrics_daily.sold_premium_cents, EXCLUDED.sold_premium_cents),
    updated_at         = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Part 2: Register trigger (includes DELETE for sale corrections/removals)
CREATE TRIGGER trg_sync_lqs_sales_metrics
  AFTER INSERT OR UPDATE OR DELETE ON lqs_sales
  FOR EACH ROW
  EXECUTE FUNCTION sync_lqs_sales_to_metrics_daily();

-- Part 3: Backfill existing sales (only updates existing metrics_daily rows;
-- new rows require kpi_version_id which varies per agency)
UPDATE metrics_daily md
SET
  sold_items         = GREATEST(md.sold_items, agg.total_items),
  sold_policies      = GREATEST(md.sold_policies, agg.total_policies),
  sold_premium_cents = GREATEST(md.sold_premium_cents, agg.total_premium),
  updated_at         = now()
FROM (
  SELECT team_member_id, sale_date,
    SUM(items_sold) as total_items,
    SUM(policies_sold) as total_policies,
    SUM(premium_cents) as total_premium
  FROM lqs_sales
  WHERE team_member_id IS NOT NULL
  GROUP BY team_member_id, sale_date
) agg
WHERE agg.team_member_id = md.team_member_id
  AND agg.sale_date = md.date;
