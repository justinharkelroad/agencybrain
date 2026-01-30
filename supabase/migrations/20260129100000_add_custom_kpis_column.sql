-- Add JSONB column to store custom KPI values
-- Format: { "kpis.key": numeric_value, ... }
-- Example: { "custom_1769616315662": 15, "custom_1769554851688": 180 }
ALTER TABLE public.metrics_daily
ADD COLUMN IF NOT EXISTS custom_kpis JSONB DEFAULT '{}';

-- Add index for JSONB queries if needed later
CREATE INDEX IF NOT EXISTS idx_metrics_daily_custom_kpis
ON public.metrics_daily USING gin (custom_kpis);

COMMENT ON COLUMN public.metrics_daily.custom_kpis IS
'Stores custom KPI values keyed by kpis.key (e.g., custom_1769616315662). Values are numeric.';
