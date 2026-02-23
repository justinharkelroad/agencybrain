-- Fix bundle_type detection for today's sales
-- Previous backfill missed the bundle detection step

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203183000_fix_bundle_detection_for_today: table public.sales does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.sale_policies') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203183000_fix_bundle_detection_for_today: table public.sale_policies does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.policy_types') IS NULL OR to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203183000_fix_bundle_detection_for_today: missing policy_types or product_types.';
    RETURN;
  END IF;

  WITH sale_products AS (
    SELECT
      s.id as sale_id,
      ARRAY_AGG(DISTINCT LOWER(COALESCE(pt.name, sp.policy_type_name))) as product_names
    FROM public.sales s
    JOIN public.sale_policies sp ON sp.sale_id = s.id
    LEFT JOIN public.policy_types pol ON sp.product_type_id = pol.id
    LEFT JOIN public.product_types pt ON pol.product_type_id = pt.id
    WHERE s.created_at >= '2026-02-03 00:00:00'::timestamptz
      AND s.created_at < '2026-02-04 00:00:00'::timestamptz
    GROUP BY s.id
  ),
  bundle_detection AS (
    SELECT
      sale_id,
      -- Check for auto products (Standard Auto, Non-Standard Auto, Specialty Auto)
      -- Note: Motorcycle is NOT included - it doesn't create Preferred bundle with Home
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn IN ('standard auto', 'non-standard auto', 'specialty auto')
      ) as has_auto,
      -- Check for home products
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn IN ('homeowners', 'north light homeowners', 'condo', 'north light condo')
      ) as has_home,
      array_length(product_names, 1) as policy_count
    FROM sale_products
  )
  UPDATE public.sales s
  SET
    is_bundle = bd.policy_count > 1 OR (bd.has_auto AND bd.has_home),
    bundle_type = CASE
      WHEN bd.has_auto AND bd.has_home THEN 'Preferred'
      WHEN bd.policy_count > 1 THEN 'Standard'
      ELSE NULL
    END
  FROM bundle_detection bd
  WHERE s.id = bd.sale_id;
END $$;
