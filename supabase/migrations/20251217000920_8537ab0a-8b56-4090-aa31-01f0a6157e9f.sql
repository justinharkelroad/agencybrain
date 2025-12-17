-- Add staff_can_upload_calls column to agencies table
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS staff_can_upload_calls BOOLEAN DEFAULT true;