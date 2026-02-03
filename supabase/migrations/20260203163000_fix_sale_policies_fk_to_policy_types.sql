-- Fix FK constraints on sale_policies and sale_items to reference policy_types instead of product_types
--
-- Issue: The forms use policy_types (agency-specific) but the FK pointed to product_types (global).
-- After merging policy_types with product_types names, the IDs don't match, causing FK violations.

-- Drop existing FK constraints
ALTER TABLE sale_policies DROP CONSTRAINT IF EXISTS sale_policies_product_type_id_fkey;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_type_id_fkey;

-- Clear orphaned product_type_id values that don't exist in policy_types
-- These are old references to the global product_types table
UPDATE sale_policies
SET product_type_id = NULL
WHERE product_type_id IS NOT NULL
  AND product_type_id NOT IN (SELECT id FROM policy_types);

UPDATE sale_items
SET product_type_id = NULL
WHERE product_type_id IS NOT NULL
  AND product_type_id NOT IN (SELECT id FROM policy_types);

-- Add new FK constraints referencing policy_types
-- Using ON DELETE SET NULL since policy types can be deleted/deactivated
ALTER TABLE sale_policies
  ADD CONSTRAINT sale_policies_product_type_id_fkey
  FOREIGN KEY (product_type_id) REFERENCES policy_types(id) ON DELETE SET NULL;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_product_type_id_fkey
  FOREIGN KEY (product_type_id) REFERENCES policy_types(id) ON DELETE SET NULL;
