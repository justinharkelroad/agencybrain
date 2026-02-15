-- Extend coaching insight settings with configurable feature flags, windows,
-- benchmark config, and templates.
ALTER TABLE public.coaching_insight_settings
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_windows jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS benchmark_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suggestion_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
