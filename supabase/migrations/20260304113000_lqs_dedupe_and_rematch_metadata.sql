-- Phase 1: Persist upload producer/dedupe metadata for LQS sales
-- and support reliable producer rematch after team changes.

ALTER TABLE public.lqs_sales
  ADD COLUMN IF NOT EXISTS raw_subproducer_code text,
  ADD COLUMN IF NOT EXISTS raw_subproducer_name text,
  ADD COLUMN IF NOT EXISTS match_status text,
  ADD COLUMN IF NOT EXISTS dedupe_status text,
  ADD COLUMN IF NOT EXISTS dedupe_reason text,
  ADD COLUMN IF NOT EXISTS dedupe_fingerprint text,
  ADD COLUMN IF NOT EXISTS rematched_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lqs_sales_match_status_check'
      AND conrelid = 'public.lqs_sales'::regclass
  ) THEN
    ALTER TABLE public.lqs_sales
      ADD CONSTRAINT lqs_sales_match_status_check
      CHECK (match_status IN ('matched', 'unassigned', 'rematched'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lqs_sales_dedupe_status_check'
      AND conrelid = 'public.lqs_sales'::regclass
  ) THEN
    ALTER TABLE public.lqs_sales
      ADD CONSTRAINT lqs_sales_dedupe_status_check
      CHECK (dedupe_status IN ('new', 'hard_duplicate', 'likely_duplicate', 'possible_duplicate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lqs_sales_agency_raw_subproducer_code
  ON public.lqs_sales (agency_id, raw_subproducer_code);

CREATE INDEX IF NOT EXISTS idx_lqs_sales_agency_match_status
  ON public.lqs_sales (agency_id, match_status);

CREATE INDEX IF NOT EXISTS idx_lqs_sales_agency_dedupe_status
  ON public.lqs_sales (agency_id, dedupe_status);

CREATE INDEX IF NOT EXISTS idx_lqs_sales_dedupe_fingerprint
  ON public.lqs_sales (dedupe_fingerprint)
  WHERE dedupe_fingerprint IS NOT NULL;
