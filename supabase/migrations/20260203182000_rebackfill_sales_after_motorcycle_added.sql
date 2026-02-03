-- Re-backfill sales after adding Motorcycle product type
-- The previous backfill ran before Motorcycle existed, so those sales still have 0 points

-- Step 1: Update sale_items with correct points and VC status
UPDATE sale_items si
SET
  points = COALESCE(pt.default_points, 0) * si.item_count,
  is_vc_qualifying = COALESCE(pt.is_vc_item, false)
FROM policy_types pol
LEFT JOIN product_types pt ON pol.product_type_id = pt.id
WHERE si.product_type_id = pol.id
  AND si.created_at >= '2026-02-03 00:00:00'::timestamptz
  AND si.created_at < '2026-02-04 00:00:00'::timestamptz;

-- Step 2: Update sale_policies totals from their items
UPDATE sale_policies sp
SET
  total_points = item_totals.total_points,
  is_vc_qualifying = item_totals.has_vc
FROM (
  SELECT
    si.sale_policy_id,
    SUM(si.points) as total_points,
    BOOL_OR(si.is_vc_qualifying) as has_vc
  FROM sale_items si
  JOIN sale_policies sp2 ON si.sale_policy_id = sp2.id
  WHERE sp2.created_at >= '2026-02-03 00:00:00'::timestamptz
    AND sp2.created_at < '2026-02-04 00:00:00'::timestamptz
  GROUP BY si.sale_policy_id
) item_totals
WHERE sp.id = item_totals.sale_policy_id;

-- Step 3: Update sales totals from their items
UPDATE sales s
SET
  total_points = sale_totals.total_points,
  vc_items = sale_totals.vc_items,
  vc_premium = sale_totals.vc_premium,
  vc_points = sale_totals.vc_points,
  is_vc_qualifying = sale_totals.vc_items > 0
FROM (
  SELECT
    si.sale_id,
    SUM(si.points) as total_points,
    SUM(CASE WHEN si.is_vc_qualifying THEN si.item_count ELSE 0 END) as vc_items,
    SUM(CASE WHEN si.is_vc_qualifying THEN si.premium ELSE 0 END) as vc_premium,
    SUM(CASE WHEN si.is_vc_qualifying THEN si.points ELSE 0 END) as vc_points
  FROM sale_items si
  JOIN sales s2 ON si.sale_id = s2.id
  WHERE s2.created_at >= '2026-02-03 00:00:00'::timestamptz
    AND s2.created_at < '2026-02-04 00:00:00'::timestamptz
  GROUP BY si.sale_id
) sale_totals
WHERE s.id = sale_totals.sale_id;
