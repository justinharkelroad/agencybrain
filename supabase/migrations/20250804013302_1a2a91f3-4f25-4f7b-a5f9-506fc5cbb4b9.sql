-- Legacy shim: column mappings schema and policies are already established in
-- 20250804013212_0c5556ae-7f0b-4cb1-bdb8-3ab6419c23dd.
-- This migration is intentionally a no-op.

DO $$
BEGIN
  RAISE NOTICE 'Skipping this migration; column_mappings schema is managed in 20250804013212...';
END $$;
