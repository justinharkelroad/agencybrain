-- Fix: Convert onboarding_sequences.target_type from ENUM to TEXT
--
-- Bug: Migration 20260205100000 was supposed to convert target_type from
--   onboarding_sequence_target_type ENUM to TEXT, allowing admin-defined custom
--   sequence types (e.g. 'coi_connection_sequence'). The migration was recorded
--   as applied but the column conversion silently failed — the column is still
--   ENUM in production.
--
-- Impact: Any sequence created with a custom type_key (not one of the 5 original
--   enum values) fails with "invalid input value for enum" error.
--
-- Fix: Use ALTER COLUMN ... TYPE text to convert in-place, which is simpler and
--   more reliable than the original add-column/drop-column/rename approach.

-- Step 1: Drop the enum default (references the enum type)
ALTER TABLE onboarding_sequences
  ALTER COLUMN target_type DROP DEFAULT;

-- Step 2: Convert the column type from ENUM to TEXT in-place
ALTER TABLE onboarding_sequences
  ALTER COLUMN target_type TYPE text USING target_type::text;

-- Step 3: Re-set the default as a plain text value
ALTER TABLE onboarding_sequences
  ALTER COLUMN target_type SET DEFAULT 'onboarding';

-- Step 4: Recreate the index (the old one was dropped with the type change)
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_target_type_text
  ON onboarding_sequences(agency_id, target_type);

-- Step 5: Reload PostgREST schema cache so the REST API sees the new column type
NOTIFY pgrst, 'reload schema';
