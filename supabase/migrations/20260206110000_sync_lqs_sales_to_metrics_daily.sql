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

  -- Upsert into metrics_daily
  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    sold_items, sold_policies, sold_premium_cents
  )
  VALUES (
    v_agency_id, v_team_member_id, v_sale_date,
    COALESCE(v_role, 'Sales'),
    v_items, v_policies, v_premium
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

-- Part 3: Backfill existing sales
INSERT INTO metrics_daily (agency_id, team_member_id, date, role,
  sold_items, sold_policies, sold_premium_cents)
SELECT
  ls.agency_id,
  ls.team_member_id,
  ls.sale_date,
  COALESCE(tm.role, 'Sales'),
  SUM(ls.items_sold),
  SUM(ls.policies_sold),
  SUM(ls.premium_cents)
FROM lqs_sales ls
JOIN team_members tm ON tm.id = ls.team_member_id
WHERE ls.team_member_id IS NOT NULL
GROUP BY ls.agency_id, ls.team_member_id, ls.sale_date, tm.role
ON CONFLICT (team_member_id, date) DO UPDATE SET
  sold_items         = GREATEST(metrics_daily.sold_items, EXCLUDED.sold_items),
  sold_policies      = GREATEST(metrics_daily.sold_policies, EXCLUDED.sold_policies),
  sold_premium_cents = GREATEST(metrics_daily.sold_premium_cents, EXCLUDED.sold_premium_cents),
  updated_at         = now();
