-- Phase A: Step 1 - Create the flattener function for quoted_household_details (fixed version)
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_rec RECORD;
  row     jsonb;
  idx     int := 0;
BEGIN
  -- Load submission with form template for agency context
  SELECT 
    sub.id, 
    sub.team_member_id, 
    sub.work_date, 
    sub.submission_date, 
    sub.payload_json,
    ft.agency_id
  INTO sub_rec
  FROM public.submissions sub
  JOIN public.form_templates ft ON ft.id = sub.form_template_id
  WHERE sub.id = p_submission;

  IF sub_rec.id IS NULL THEN
    RAISE NOTICE 'flatten_quoted_household_details: submission % not found', p_submission;
    RETURN;
  END IF;

  -- Clear existing to avoid duplicates on re-finalize
  DELETE FROM public.quoted_household_details WHERE submission_id = sub_rec.id;

  -- Flatten each quoted_details row
  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(sub_rec.payload_json->'quoted_details')-1, -1))
  LOOP
    row := (sub_rec.payload_json->'quoted_details')->idx;

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
      sub_rec.id,
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
      COALESCE(sub_rec.work_date, sub_rec.submission_date, now())
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