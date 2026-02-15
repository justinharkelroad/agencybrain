-- Add per-agency toggle for dashboard call metrics redesign (metric rings + accordion layout)
-- Defaults to false so existing agencies see the original dashboard
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS dashboard_call_metrics_enabled BOOLEAN DEFAULT false;

-- Enable for the two agencies that already had the redesign via hardcoded access
UPDATE agencies SET dashboard_call_metrics_enabled = true
WHERE id IN (
  '16889dfb-b836-467d-986d-fcc3f0390eb3', -- The Katyl Agency
  '979e8713-c266-4b23-96a9-fabd34f1fc9e'  -- Harkelroad Family Insurance
);
