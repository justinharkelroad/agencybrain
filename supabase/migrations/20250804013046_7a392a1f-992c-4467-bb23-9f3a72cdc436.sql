-- Legacy shim: table ownership for column mappings moved to migration
-- 20250804013212_0c5556ae-7f0b-4cb1-bdb8-3ab6419c23dd.
-- This migration intentionally keeps historical migration order without introducing
-- the now-removed `public.agencies` dependency.

DO $$
BEGIN
  RAISE NOTICE 'Skipping this migration; column_mappings schema is managed in 20250804013212...';
END $$;
