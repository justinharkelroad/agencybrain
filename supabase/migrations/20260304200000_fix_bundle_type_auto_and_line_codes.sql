-- Fix bundle_type: only Standard Auto qualifies for Preferred (not Non-Standard
-- or Specialty), and handle Allstate line-code-prefixed product names like
-- "010 - Auto - Private Passenger Voluntary" and "070 - Homeowners".
--
-- Previous backfills (20260218, 20260219) included non-standard auto and
-- specialty auto as qualifying for Preferred bundles, and did not recognize
-- line-code-prefixed product names from Allstate report uploads.

WITH sale_products AS (
  SELECT
    s.id as sale_id,
    s.existing_customer_products,
    ARRAY_AGG(DISTINCT LOWER(COALESCE(pt.name, sp.policy_type_name))) as product_names,
    array_length(ARRAY_AGG(DISTINCT sp.id), 1) as policy_count
  FROM public.sales s
  JOIN public.sale_policies sp ON sp.sale_id = s.id
  LEFT JOIN public.policy_types pol ON sp.product_type_id = pol.id
  LEFT JOIN public.product_types pt ON pol.product_type_id = pt.id
  GROUP BY s.id
),
bundle_detection AS (
  SELECT
    sale_id,
    -- has_auto: ONLY "standard auto" or line code 010 qualifies for Preferred
    (
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn = 'standard auto'
           OR pn = 'auto'
           OR pn LIKE '010 -%'
           OR pn LIKE '010-%'
      )
      OR 'auto' = ANY(existing_customer_products)
    ) as has_auto,
    -- has_home: homeowners (070), condo (078), or canonical names
    (
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn IN ('homeowners', 'north light homeowners', 'condo', 'north light condo')
           OR pn LIKE '070 -%' OR pn LIKE '070-%'
           OR pn LIKE '078 -%' OR pn LIKE '078-%'
           OR pn LIKE '074 -%' OR pn LIKE '074-%'
      )
      OR 'home' = ANY(existing_customer_products)
    ) as has_home,
    policy_count,
    COALESCE(array_length(existing_customer_products, 1), 0) as existing_count
  FROM sale_products
)
UPDATE public.sales s
SET
  is_bundle = (bd.policy_count + bd.existing_count) > 1 OR (bd.has_auto AND bd.has_home),
  bundle_type = CASE
    WHEN bd.has_auto AND bd.has_home THEN 'Preferred'
    WHEN (bd.policy_count + bd.existing_count) > 1 THEN 'Standard'
    ELSE NULL
  END
FROM bundle_detection bd
WHERE s.id = bd.sale_id
  AND (
    s.bundle_type IS DISTINCT FROM (
      CASE
        WHEN bd.has_auto AND bd.has_home THEN 'Preferred'
        WHEN (bd.policy_count + bd.existing_count) > 1 THEN 'Standard'
        ELSE NULL
      END
    )
    OR s.is_bundle IS DISTINCT FROM ((bd.policy_count + bd.existing_count) > 1 OR (bd.has_auto AND bd.has_home))
  );
