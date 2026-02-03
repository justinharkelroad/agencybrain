-- Add Motorcycle to global product_types
-- Motorcycle was missing from the default product types list

-- Insert Motorcycle as a global product type (agency_id IS NULL)
-- Using similar comp values to other vehicle products
INSERT INTO product_types (name, category, default_points, is_vc_item, term_months, is_brokered, is_active, agency_id)
VALUES ('Motorcycle', 'Auto', 5, true, 12, false, true, NULL)
ON CONFLICT DO NOTHING;

-- Also ensure it's linked in any agency's policy_types that have "Motorcycle" as a name
UPDATE policy_types pt
SET product_type_id = (
  SELECT id FROM product_types
  WHERE LOWER(name) = 'motorcycle'
    AND agency_id IS NULL
  LIMIT 1
)
WHERE LOWER(pt.name) LIKE '%motorcycle%'
  AND pt.product_type_id IS NULL;
