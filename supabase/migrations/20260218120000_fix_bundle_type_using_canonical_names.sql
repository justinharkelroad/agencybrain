-- Fix bundle_type on all sales by resolving canonical product names
-- through the policy_types → product_types link chain.
--
-- Bug: PdfUploadForm used display names (e.g. "Auto Insurance") instead of
-- canonical names (e.g. "Standard Auto") for bundle detection, causing
-- Auto+Home sales to be classified as "Standard" instead of "Preferred".

WITH sale_products AS (
  SELECT
    s.id as sale_id,
    ARRAY_AGG(DISTINCT LOWER(COALESCE(pt.name, sp.policy_type_name))) as product_names
  FROM public.sales s
  JOIN public.sale_policies sp ON sp.sale_id = s.id
  LEFT JOIN public.policy_types pol ON sp.product_type_id = pol.id
  LEFT JOIN public.product_types pt ON pol.product_type_id = pt.id
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
WHERE s.id = bd.sale_id
  -- Only update rows where the bundle_type would actually change
  AND (
    s.bundle_type IS DISTINCT FROM (
      CASE
        WHEN bd.has_auto AND bd.has_home THEN 'Preferred'
        WHEN bd.policy_count > 1 THEN 'Standard'
        ELSE NULL
      END
    )
    OR s.is_bundle IS DISTINCT FROM (bd.policy_count > 1 OR (bd.has_auto AND bd.has_home))
  );
