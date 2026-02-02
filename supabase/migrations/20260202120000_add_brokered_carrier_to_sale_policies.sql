-- Add per-policy brokered carrier support
-- This allows each policy within a sale to independently be brokered or not

-- Add brokered_carrier_id column to sale_policies
ALTER TABLE sale_policies
ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid REFERENCES brokered_carriers(id);

-- Create index for efficient filtering by brokered policies
CREATE INDEX IF NOT EXISTS idx_sale_policies_brokered_carrier
ON sale_policies(brokered_carrier_id) WHERE brokered_carrier_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN sale_policies.brokered_carrier_id IS 'Reference to brokered carrier for this policy. If set, indicates this policy is through a non-captive carrier.';
