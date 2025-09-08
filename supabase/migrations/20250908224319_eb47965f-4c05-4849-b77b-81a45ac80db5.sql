-- Add metric_slug column to metrics_daily table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metrics_daily' AND column_name = 'metric_slug') THEN
        ALTER TABLE metrics_daily ADD COLUMN metric_slug TEXT;
    END IF;
END $$;

-- Add selected_metric_slugs column to scorecard_rules table if not exists  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scorecard_rules' AND column_name = 'selected_metric_slugs') THEN
        ALTER TABLE scorecard_rules ADD COLUMN selected_metric_slugs TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Backfill selected_metric_slugs from selected_metrics where possible
UPDATE scorecard_rules 
SET selected_metric_slugs = COALESCE(selected_metrics, '{}')
WHERE selected_metric_slugs IS NULL OR array_length(selected_metric_slugs, 1) IS NULL;

-- Create index for better performance on metric_slug lookups
CREATE INDEX IF NOT EXISTS idx_metrics_daily_metric_slug ON metrics_daily(metric_slug);
CREATE INDEX IF NOT EXISTS idx_scorecard_rules_selected_metric_slugs ON scorecard_rules USING GIN(selected_metric_slugs);