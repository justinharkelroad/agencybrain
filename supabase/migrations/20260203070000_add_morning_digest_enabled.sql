-- Add morning digest email setting to agencies table
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS morning_digest_enabled BOOLEAN DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.agencies.morning_digest_enabled IS
'When true, sends a morning digest email at 7 AM local time to agency owner and key employees with yesterday highlights and today awareness items';
