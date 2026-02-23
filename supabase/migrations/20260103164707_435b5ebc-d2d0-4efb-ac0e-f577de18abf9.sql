DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL OR to_regclass('public.lead_sources') IS NULL THEN
    RAISE NOTICE 'Skipping sales lead_source_id migration: required table(s) not present.';
    RETURN;
  END IF;

  ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id);
END $$ LANGUAGE plpgsql;
