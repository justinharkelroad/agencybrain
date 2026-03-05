-- Recompute sales.is_bundle and sales.bundle_type from all-time household
-- history using the same canonical bundle rules as the application.
--
-- Why this migration exists:
-- 1. Recent app logic now classifies bundles by all historical sales for the
--    household key (customer_name + customer_zip, falling back to name).
-- 2. Older backfills updated each sale mostly from its own policies plus
--    existing_customer_products, which can leave persisted bundle state behind.
-- 3. Compensation, dashboards, and any DB-driven analytics that read
--    sales.is_bundle / sales.bundle_type need these persisted columns to match.

WITH sale_households AS (
  SELECT
    s.id AS sale_id,
    CASE
      WHEN NULLIF(LOWER(BTRIM(s.customer_name)), '') IS NULL THEN 'sale:' || s.id::text
      WHEN NULLIF(BTRIM(s.customer_zip), '') IS NOT NULL THEN LOWER(BTRIM(s.customer_name)) || '|' || BTRIM(s.customer_zip)
      ELSE LOWER(BTRIM(s.customer_name))
    END AS household_key
  FROM public.sales s
),
policy_products AS (
  SELECT
    sh.sale_id,
    sh.household_key,
    CASE
      WHEN product_name IN ('motor club', 'bundle') THEN NULL
      WHEN product_name IN ('standard auto', 'auto', 'personal auto')
        OR product_name LIKE '010 -%'
        OR product_name LIKE '010-%'
      THEN 'standard_auto'
      WHEN product_name IN ('homeowners', 'north light homeowners', 'home')
        OR product_name LIKE '070 -%'
        OR product_name LIKE '070-%'
      THEN 'homeowners'
      WHEN product_name IN ('condo', 'north light condo', 'condominium')
        OR product_name LIKE '074 -%'
        OR product_name LIKE '074-%'
        OR product_name LIKE '078 -%'
        OR product_name LIKE '078-%'
      THEN 'condo'
      WHEN product_name IN ('renters', 'landlords', 'landlord package', 'landlord/dwelling', 'mobilehome', 'manufactured home')
        OR product_name LIKE '072 -%'
        OR product_name LIKE '072-%'
        OR product_name LIKE '073 -%'
        OR product_name LIKE '073-%'
      THEN 'property_other'
      WHEN product_name IN ('non-standard auto', 'auto - special', 'specialty auto', 'motorcycle', 'boatowners', 'personal umbrella', 'off-road vehicle', 'recreational vehicle', 'flood')
        OR product_name LIKE '020 -%'
        OR product_name LIKE '020-%'
        OR product_name LIKE '021 -%'
        OR product_name LIKE '021-%'
        OR product_name LIKE '080 -%'
        OR product_name LIKE '080-%'
        OR product_name LIKE '090 -%'
        OR product_name LIKE '090-%'
      THEN 'other_recognized'
      ELSE NULL
    END AS canonical_product
  FROM sale_households sh
  JOIN public.sale_policies sp
    ON sp.sale_id = sh.sale_id
  LEFT JOIN public.policy_types pol
    ON pol.id = sp.product_type_id
  LEFT JOIN public.product_types pt
    ON pt.id = pol.product_type_id
  CROSS JOIN LATERAL (
    SELECT LOWER(BTRIM(COALESCE(pt.name, sp.policy_type_name, ''))) AS product_name
  ) resolved
),
existing_products AS (
  SELECT
    sh.sale_id,
    sh.household_key,
    CASE LOWER(BTRIM(existing_product.product_flag))
      WHEN 'auto' THEN 'standard_auto'
      WHEN 'home' THEN 'homeowners'
      WHEN 'condo' THEN 'condo'
      WHEN 'renters' THEN 'property_other'
      WHEN 'landlords' THEN 'property_other'
      WHEN 'umbrella' THEN 'other_recognized'
      WHEN 'boat' THEN 'other_recognized'
      WHEN 'motorcycle' THEN 'other_recognized'
      WHEN 'specialty_auto' THEN 'other_recognized'
      WHEN 'non_standard_auto' THEN 'other_recognized'
      WHEN 'other' THEN 'other_recognized'
      ELSE NULL
    END AS canonical_product
  FROM sale_households sh
  JOIN public.sales s
    ON s.id = sh.sale_id
  CROSS JOIN LATERAL UNNEST(COALESCE(s.existing_customer_products, ARRAY[]::text[])) AS existing_product(product_flag)
),
all_household_products AS (
  SELECT sale_id, household_key, canonical_product
  FROM policy_products
  WHERE canonical_product IS NOT NULL

  UNION ALL

  SELECT sale_id, household_key, canonical_product
  FROM existing_products
  WHERE canonical_product IS NOT NULL
),
household_bundle_state AS (
  SELECT
    household_key,
    COUNT(DISTINCT canonical_product) AS recognized_product_count,
    BOOL_OR(canonical_product = 'standard_auto') AS has_standard_auto,
    BOOL_OR(canonical_product IN ('homeowners', 'condo')) AS has_anchor_home
  FROM all_household_products
  GROUP BY household_key
),
sale_bundle_targets AS (
  SELECT
    sh.sale_id,
    COALESCE(hbs.recognized_product_count, 0) AS recognized_product_count,
    COALESCE(hbs.has_standard_auto, FALSE) AS has_standard_auto,
    COALESCE(hbs.has_anchor_home, FALSE) AS has_anchor_home
  FROM sale_households sh
  LEFT JOIN household_bundle_state hbs
    ON hbs.household_key = sh.household_key
)
UPDATE public.sales s
SET
  is_bundle = sbt.recognized_product_count >= 2,
  bundle_type = CASE
    WHEN sbt.has_standard_auto AND sbt.has_anchor_home THEN 'Preferred'
    WHEN sbt.recognized_product_count >= 2 THEN 'Standard'
    ELSE NULL
  END
FROM sale_bundle_targets sbt
WHERE s.id = sbt.sale_id
  AND (
    s.is_bundle IS DISTINCT FROM (sbt.recognized_product_count >= 2)
    OR s.bundle_type IS DISTINCT FROM (
      CASE
        WHEN sbt.has_standard_auto AND sbt.has_anchor_home THEN 'Preferred'
        WHEN sbt.recognized_product_count >= 2 THEN 'Standard'
        ELSE NULL
      END
    )
  );
