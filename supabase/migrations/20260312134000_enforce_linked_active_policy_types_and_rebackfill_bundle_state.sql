-- Prevent active policy_types from remaining unlinked to a canonical product_type
-- and re-backfill sales bundle state using household-history canonical rules.

DO $$
BEGIN
  IF to_regclass('public.policy_types') IS NULL OR to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping policy_types enforcement migration because required tables do not exist.';
    RETURN;
  END IF;

  -- Backfill any remaining exact-name matches first.
  UPDATE public.policy_types pt
  SET product_type_id = matched.product_type_id
  FROM (
    SELECT DISTINCT ON (pt2.id)
      pt2.id AS policy_type_id,
      prod.id AS product_type_id
    FROM public.policy_types pt2
    JOIN public.product_types prod
      ON LOWER(BTRIM(prod.name)) = LOWER(BTRIM(pt2.name))
    WHERE pt2.product_type_id IS NULL
      AND prod.is_active = true
    ORDER BY pt2.id, prod.agency_id NULLS FIRST
  ) matched
  WHERE pt.id = matched.policy_type_id
    AND pt.product_type_id IS NULL;

  -- Any policy type still unlinked is unsafe for bundle analytics and comp.
  UPDATE public.policy_types
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
    AND product_type_id IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_active_policy_type_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND NEW.product_type_id IS NULL THEN
    RAISE EXCEPTION 'Active policy types must be linked to a product type';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_active_policy_type_link ON public.policy_types;

CREATE TRIGGER enforce_active_policy_type_link
BEFORE INSERT OR UPDATE OF is_active, product_type_id
ON public.policy_types
FOR EACH ROW
EXECUTE FUNCTION public.enforce_active_policy_type_link();

-- Recompute sales.is_bundle and sales.bundle_type from all-time household history
-- after policy_type link corrections so persisted bundle state matches analytics.
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
