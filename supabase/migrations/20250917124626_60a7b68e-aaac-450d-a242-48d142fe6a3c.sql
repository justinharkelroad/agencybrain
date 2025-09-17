-- Phase A: Step 1 - Create the flattener function for quoted_household_details
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s     RECORD;
  row   jsonb;
  idx   int := 0;
BEGIN
  -- Load submission with form template for agency context
  SELECT 
    s.id, 
    s.team_member_id, 
    s.work_date, 
    s.submission_date, 
    s.payload_json,
    ft.agency_id
  INTO s
  FROM public.submissions s
  JOIN public.form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission;

  IF s.id IS NULL THEN
    RAISE NOTICE 'flatten_quoted_household_details: submission % not found', p_submission;
    RETURN;
  END IF;

  -- Clear existing to avoid duplicates on re-finalize
  DELETE FROM public.quoted_household_details WHERE submission_id = s.id;

  -- Flatten each quoted_details row
  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(s.payload_json->'quoted_details')-1, -1))
  LOOP
    row := (s.payload_json->'quoted_details')->idx;

    IF row IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.quoted_household_details (
      submission_id,
      household_name,
      lead_source_id,
      zip_code,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      policy_type,
      extras,
      created_at
    )
    VALUES (
      s.id,
      coalesce(row->>'prospect_name', row->>'household_name', 'Unknown'),
      -- Convert lead_source_id from text to UUID if valid
      CASE 
        WHEN row->>'lead_source_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN (row->>'lead_source_id')::uuid 
        ELSE NULL 
      END,
      COALESCE(row->>'zip_code', row->>'zip'),
      COALESCE((row->>'items_quoted')::int, NULL),
      COALESCE((row->>'policies_quoted')::int, NULL),
      COALESCE((row->>'premium_potential_cents')::bigint, NULL),
      COALESCE(row->>'policy_type', NULL),
      row, -- Store full row for audit
      COALESCE(s.work_date, s.submission_date, now())
    );
  END LOOP;
END;
$$;

-- Step 2: Update the existing trigger to include the new flattener
CREATE OR REPLACE FUNCTION public.trg_apply_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.final IS true THEN
      PERFORM public.upsert_metrics_from_submission(NEW.id);
      PERFORM public.flatten_quoted_details(NEW.id);
      PERFORM public.flatten_quoted_household_details(NEW.id);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.final IS true AND (
         OLD.final IS DISTINCT FROM NEW.final
      OR OLD.payload_json IS DISTINCT FROM NEW.payload_json
      OR OLD.work_date IS DISTINCT FROM NEW.work_date
      OR OLD.submission_date IS DISTINCT FROM NEW.submission_date
      OR OLD.late IS DISTINCT FROM NEW.late
    ) THEN
      PERFORM public.upsert_metrics_from_submission(NEW.id);
      PERFORM public.flatten_quoted_details(NEW.id);
      PERFORM public.flatten_quoted_household_details(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: One-time backfill for recent finals (last 60 days to be safe)
DO $$
DECLARE 
  r RECORD;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of quoted_household_details for recent submissions...';
  
  FOR r IN
    SELECT id, submission_date 
    FROM public.submissions
    WHERE final = true 
      AND submission_date >= (CURRENT_DATE - INTERVAL '60 days')
    ORDER BY submission_date DESC
  LOOP
    PERFORM public.flatten_quoted_household_details(r.id);
    processed_count := processed_count + 1;
    
    -- Log progress every 50 records
    IF processed_count % 50 = 0 THEN
      RAISE NOTICE 'Processed % submissions...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Processed % final submissions.', processed_count;
END$$;

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_qhd_created_at ON public.quoted_household_details(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qhd_submission_id ON public.quoted_household_details(submission_id);
CREATE INDEX IF NOT EXISTS idx_qhd_household_name ON public.quoted_household_details(household_name);
CREATE INDEX IF NOT EXISTS idx_qhd_items_quoted ON public.quoted_household_details(items_quoted);
CREATE INDEX IF NOT EXISTS idx_qhd_policies_quoted ON public.quoted_household_details(policies_quoted);