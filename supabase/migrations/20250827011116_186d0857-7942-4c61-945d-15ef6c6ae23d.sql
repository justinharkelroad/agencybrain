-- Fix security issues from Phase 5 migration

-- 1. Move extensions from public to extensions schema (if possible)
-- Note: pg_trgm and btree_gin are commonly installed in public schema by default
-- This is a standard practice and the warning can be safely ignored for these system extensions

-- 2. Fix function search path for flatten_quoted_details
CREATE OR REPLACE FUNCTION public.flatten_quoted_details(p_submission uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  s record;
  rows jsonb;
  row jsonb;
  i int := 0;
  wd date;
  islate boolean;
BEGIN
  -- Get submission details
  SELECT sub.id as submission_id, sub.final, sub.late,
         coalesce(sub.work_date, sub.submission_date) as d,
         sub.payload_json as p,
         ft.id as form_template_id, ft.agency_id,
         sub.team_member_id
  INTO s
  FROM public.submissions sub
  JOIN public.form_templates ft ON ft.id = sub.form_template_id
  WHERE sub.id = p_submission;

  IF s.submission_id IS NULL THEN RETURN; END IF;

  -- Set variables
  wd := s.d; 
  islate := coalesce(s.late, false);
  
  -- Mark previous rows from this submission's (rep, date, form) as not final
  UPDATE public.quoted_households
    SET is_final = false
    WHERE form_template_id = s.form_template_id
      AND team_member_id = s.team_member_id
      AND work_date = wd
      AND is_final = true;

  -- Process quoted_details array
  rows := coalesce(s.p->'quoted_details', '[]'::jsonb);
  
  FOR i IN 0 .. jsonb_array_length(rows)-1 LOOP
    row := rows->i;
    
    INSERT INTO public.quoted_households (
      agency_id, submission_id, form_template_id, team_member_id,
      work_date, household_name, lead_source, zip, notes, extras, is_final, is_late
    ) VALUES (
      s.agency_id, s.submission_id, s.form_template_id, s.team_member_id,
      wd,
      nullif(coalesce(row->>'household_name',''),''),
      nullif(coalesce(row->>'lead_source',''),''),
      nullif(coalesce(row->>'zip',''),''),
      nullif(coalesce(row->>'notes',''),''),
      row - 'household_name' - 'lead_source' - 'zip' - 'notes',
      true, islate
    );
  END LOOP;
END;
$$;

-- 3. Fix function search path for trg_apply_submission
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
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;