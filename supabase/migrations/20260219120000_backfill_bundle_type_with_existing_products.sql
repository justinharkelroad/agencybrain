-- Backfill bundle_type considering existing_customer_products for cross-sells.
--
-- Previous backfills (20260218120000) only looked at policies within a single
-- sale. Cross-sells (e.g. selling home to a customer with existing auto) store
-- the existing product types in sales.existing_customer_products but the
-- backfill didn't consider them, leaving these sales as Standard or Monoline
-- when they should be Preferred.

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
    -- has_auto: either a new auto policy or existing auto from customer
    (
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn IN ('standard auto', 'non-standard auto', 'specialty auto')
      )
      OR 'auto' = ANY(existing_customer_products)
    ) as has_auto,
    -- has_home: either a new home policy or existing home from customer
    (
      EXISTS (
        SELECT 1 FROM unnest(product_names) pn
        WHERE pn IN ('homeowners', 'north light homeowners', 'condo', 'north light condo')
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
