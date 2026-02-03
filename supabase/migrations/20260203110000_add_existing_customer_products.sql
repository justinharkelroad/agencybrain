-- Add existing_customer_products column to sales table
-- This column stores which products the customer already owned when the sale was made
-- Used for correct bundle classification (e.g., 'auto', 'home')

ALTER TABLE sales
ADD COLUMN existing_customer_products text[] DEFAULT '{}';

COMMENT ON COLUMN sales.existing_customer_products IS
  'Products customer already owned when sale was made (auto, home). Used for bundle classification.';
