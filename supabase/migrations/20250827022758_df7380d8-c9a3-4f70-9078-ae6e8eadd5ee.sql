-- Fix the trigger to use correct JSON path
CREATE OR REPLACE FUNCTION flatten_quoted_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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

  -- Process quoted_details array from repeaterData (correct path)
  rows := coalesce(s.p->'repeaterData'->'quotedDetails', '[]'::jsonb);
  
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
      nullif(coalesce(row->>'zip_code',''),''), -- Note: zip_code not zip
      nullif(coalesce(row->>'notes',''),''),
      row - 'household_name' - 'lead_source' - 'zip_code' - 'notes',
      true, islate
    );
  END LOOP;
END;
$function$;

-- Manually trigger for existing data
DO $$
DECLARE
  sub_record record;
BEGIN
  FOR sub_record IN 
    SELECT id FROM submissions WHERE final = true
  LOOP
    PERFORM flatten_quoted_details(sub_record.id);
  END LOOP;
END $$;