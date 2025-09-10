-- Validate the constraint now that data is clean
ALTER TABLE metrics_daily VALIDATE CONSTRAINT md_version_fields_nonnull;