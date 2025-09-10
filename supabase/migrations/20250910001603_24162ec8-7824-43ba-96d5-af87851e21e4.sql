-- Add constraint to prevent future NULLs (initially not enforced to allow backfill)
ALTER TABLE metrics_daily
ADD CONSTRAINT md_version_fields_nonnull
CHECK (kpi_version_id IS NOT NULL AND label_at_submit IS NOT NULL) NOT VALID;