-- Add records_total_households column to winback_uploads
-- This tracks how many unique households were in the uploaded file,
-- distinct from records_new_households which only counts newly created ones.
-- The difference (total - new) = existing households that were updated.

ALTER TABLE winback_uploads
  ADD COLUMN IF NOT EXISTS records_total_households integer NOT NULL DEFAULT 0;

-- Backfill: for existing uploads, set total = new (best approximation)
UPDATE winback_uploads
  SET records_total_households = records_new_households
  WHERE records_total_households = 0;
