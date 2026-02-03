-- Add Motorcycle policy_type to all existing agencies that don't have one
-- Motorcycle was added to product_types but existing agencies were not given this policy type

-- Insert Motorcycle for all agencies that don't already have it
INSERT INTO policy_types (agency_id, name, product_type_id, is_active, order_index)
SELECT
  a.id as agency_id,
  'Motorcycle' as name,
  pt.id as product_type_id,
  true as is_active,
  COALESCE(
    (SELECT MAX(order_index) + 1 FROM policy_types WHERE agency_id = a.id),
    0
  ) as order_index
FROM agencies a
CROSS JOIN (
  SELECT id FROM product_types
  WHERE name = 'Motorcycle'
    AND agency_id IS NULL
    AND is_active = true
  LIMIT 1
) pt
WHERE NOT EXISTS (
  SELECT 1 FROM policy_types
  WHERE agency_id = a.id
    AND LOWER(name) LIKE '%motorcycle%'
);
