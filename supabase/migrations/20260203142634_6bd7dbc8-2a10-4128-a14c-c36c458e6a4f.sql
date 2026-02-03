-- Insert default policy types for all agencies that don't already have them
-- This adds all 25 global defaults from product_types to each agency's policy_types
-- Uses name-based deduplication to preserve existing custom types

INSERT INTO policy_types (id, agency_id, name, is_active, order_index, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  a.id,
  pt.name,
  true,
  ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY pt.name) + COALESCE(
    (SELECT MAX(order_index) FROM policy_types WHERE agency_id = a.id), 0
  ),
  NOW(),
  NOW()
FROM agencies a
CROSS JOIN (
  SELECT DISTINCT name FROM product_types 
  WHERE agency_id IS NULL AND is_active = true
) pt
WHERE NOT EXISTS (
  SELECT 1 FROM policy_types 
  WHERE agency_id = a.id AND LOWER(name) = LOWER(pt.name)
);