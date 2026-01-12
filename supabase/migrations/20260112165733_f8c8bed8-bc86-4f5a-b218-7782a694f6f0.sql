-- Add default_commission_rate column to agencies table
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS default_commission_rate numeric DEFAULT 22.00;