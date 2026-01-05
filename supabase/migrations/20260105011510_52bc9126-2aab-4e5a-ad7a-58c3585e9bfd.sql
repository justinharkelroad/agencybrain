-- Add sales email notification settings to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS sales_realtime_email_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS sales_daily_summary_enabled BOOLEAN DEFAULT false;

-- Add comments to explain the fields
COMMENT ON COLUMN public.agencies.sales_realtime_email_enabled IS 
'When true, sends an email to all staff when a new sale is recorded, including a live scoreboard';

COMMENT ON COLUMN public.agencies.sales_daily_summary_enabled IS 
'When true, sends a daily sales summary email at 7 PM in the agency timezone';