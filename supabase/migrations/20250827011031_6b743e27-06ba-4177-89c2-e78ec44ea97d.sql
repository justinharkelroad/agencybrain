-- Phase 5 Explorer: Database schema and functions

-- 1.1 Extensions for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 1.2 Update quoted_households table to match spec
ALTER TABLE public.quoted_households 
  DROP COLUMN IF EXISTS lead_source_id,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS form_template_id uuid REFERENCES public.form_templates(id) ON DELETE CASCADE;

-- Update existing data to populate form_template_id from submissions
UPDATE public.quoted_households 
SET form_template_id = s.form_template_id
FROM public.submissions s
WHERE public.quoted_households.submission_id = s.id
AND public.quoted_households.form_template_id IS NULL;

-- Make form_template_id NOT NULL after populating data
ALTER TABLE public.quoted_households 
  ALTER COLUMN form_template_id SET NOT NULL;

-- 1.3 Create additional indexes
CREATE INDEX IF NOT EXISTS qh_agency_date_ix ON public.quoted_households(agency_id, work_date DESC);
CREATE INDEX IF NOT EXISTS qh_member_date_ix ON public.quoted_households(team_member_id, work_date DESC);
CREATE INDEX IF NOT EXISTS qh_trgm_name_ix ON public.quoted_households USING gin (household_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS qh_extras_gin_ix ON public.quoted_households USING gin (extras jsonb_path_ops);

-- 1.4 Update RLS policies to deny anonymous access
ALTER TABLE public.quoted_households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qh_select ON public.quoted_households;
CREATE POLICY qh_select ON public.quoted_households FOR SELECT USING (false);

-- 1.5 Create flattener function
CREATE OR REPLACE FUNCTION public.flatten_quoted_details(p_submission uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
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

-- 1.6 Update existing trigger to call flattener
CREATE OR REPLACE FUNCTION public.trg_apply_submission()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
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