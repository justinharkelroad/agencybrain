-- Link policy_types to product_types for compensation/bundling/points calculations
--
-- This allows agencies to customize display names (policy_types.name) while
-- inheriting comp-related fields (default_points, is_vc_item, term_months) from
-- the linked product_types record.

-- 1. Add the product_type_id FK column (nullable for unlinked/custom types)
ALTER TABLE policy_types
ADD COLUMN IF NOT EXISTS product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL;

-- 2. Create index for efficient joins
CREATE INDEX IF NOT EXISTS idx_policy_types_product_type_id
ON policy_types(product_type_id)
WHERE product_type_id IS NOT NULL;

-- 3. Backfill existing policy_types by matching names to global product_types
-- Uses case-insensitive matching, prioritizing global (agency_id IS NULL) product_types
UPDATE policy_types pt
SET product_type_id = matched.product_type_id
FROM (
  SELECT DISTINCT ON (pt2.id)
    pt2.id as policy_type_id,
    prod.id as product_type_id
  FROM policy_types pt2
  JOIN product_types prod ON LOWER(TRIM(prod.name)) = LOWER(TRIM(pt2.name))
  WHERE pt2.product_type_id IS NULL
    AND prod.is_active = true
  ORDER BY pt2.id, prod.agency_id NULLS FIRST  -- Prefer global types
) matched
WHERE pt.id = matched.policy_type_id
  AND pt.product_type_id IS NULL;

-- 4. Add comment documenting the relationship
COMMENT ON COLUMN policy_types.product_type_id IS
'Links to product_types for compensation fields (default_points, is_vc_item, term_months). NULL means unlinked (no comp tracking for this type).';
