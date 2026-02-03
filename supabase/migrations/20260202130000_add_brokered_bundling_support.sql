-- Add support for counting brokered policies toward bundling metrics
-- This helps agencies where the captive carrier doesn't write certain products in their state

-- Flag on sales to indicate brokered policy should count toward bundling
ALTER TABLE sales ADD COLUMN brokered_counts_toward_bundling boolean DEFAULT false;

COMMENT ON COLUMN sales.brokered_counts_toward_bundling IS
  'When true, brokered policies in this sale count toward bundling metrics (households, percentage).';

-- Setting on comp_plans to enable this feature
ALTER TABLE comp_plans ADD COLUMN include_brokered_in_bundling boolean DEFAULT false;

COMMENT ON COLUMN comp_plans.include_brokered_in_bundling IS
  'When true, sales with brokered_counts_toward_bundling=true are included in bundling calculations.';
