-- 1) Drop existing view if it exists and recreate properly
DROP VIEW IF EXISTS public.vw_metrics_with_team CASCADE;

CREATE VIEW public.vw_metrics_with_team AS
SELECT
  md.*,
  COALESCE(tm.name, 'Unassigned') AS rep_name
FROM public.metrics_daily md
LEFT JOIN public.team_members tm
  ON tm.id = md.team_member_id
  AND tm.agency_id = md.agency_id;

-- 2) Create index for efficient daily queries
CREATE INDEX IF NOT EXISTS idx_metrics_daily_agency_date
  ON public.metrics_daily(agency_id, date DESC);

-- 3) Create daily dashboard function
CREATE OR REPLACE FUNCTION public.get_dashboard_daily(
  p_agency_id uuid,
  p_work_date date
)
RETURNS TABLE(
  team_member_id uuid,
  rep_name text,
  work_date date,
  outbound_calls integer,
  talk_minutes integer,
  quoted_count integer,
  sold_items integer,
  sold_policies integer,
  sold_premium_cents bigint,
  cross_sells_uncovered integer,
  mini_reviews integer,
  pass boolean,
  hits integer,
  daily_score integer,
  is_late boolean,
  status text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    vw.team_member_id,
    vw.rep_name,
    vw.date as work_date,
    vw.outbound_calls,
    vw.talk_minutes,
    vw.quoted_count,
    vw.sold_items,
    vw.sold_policies,
    vw.sold_premium_cents,
    vw.cross_sells_uncovered,
    vw.mini_reviews,
    vw.pass,
    vw.hits,
    vw.daily_score,
    vw.is_late,
    'final'::text as status
  FROM public.vw_metrics_with_team vw
  WHERE vw.agency_id = p_agency_id
    AND vw.date = p_work_date
  ORDER BY vw.rep_name NULLS LAST;
$function$;

-- 4) Enhanced flatten function with field mappings support
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  submission_rec record;
  form_mappings jsonb;
  quoted_detail jsonb;
  mapping_notes_key text;
  mapping_items_key text;
  mapping_policies_key text;
  mapping_premium_key text;
BEGIN
  -- Get submission and form template mappings
  SELECT 
    s.*, 
    ft.field_mappings,
    ft.agency_id,
    tm.id as team_member_id,
    tm.role
  INTO submission_rec
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  LEFT JOIN team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Submission % not found', p_submission_id;
    RETURN;
  END IF;

  -- Get field mappings
  form_mappings := COALESCE(submission_rec.field_mappings->'quoted_details', '{}'::jsonb);
  mapping_notes_key := form_mappings->>'notes';
  mapping_items_key := form_mappings->>'items_quoted';
  mapping_policies_key := form_mappings->>'policies_quoted';
  mapping_premium_key := form_mappings->>'premium_potential_cents';

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail
  FOR quoted_detail IN 
    SELECT jsonb_array_elements(COALESCE(submission_rec.payload_json->'quoted_details', '[]'::jsonb))
  LOOP
    -- Extract values using mappings or fallbacks
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      role,
      work_date,
      household_name,
      zip_code,
      lead_source_id,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      extras,
      created_at
    ) VALUES (
      p_submission_id,
      submission_rec.agency_id,
      submission_rec.team_member_id,
      submission_rec.role,
      COALESCE(submission_rec.work_date, submission_rec.submission_date),
      quoted_detail->>'prospect_name',
      quoted_detail->>'zip_code',
      CASE 
        WHEN quoted_detail->>'lead_source' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (quoted_detail->>'lead_source')::uuid
        ELSE NULL
      END,
      COALESCE(
        (SELECT name FROM lead_sources WHERE id = (quoted_detail->>'lead_source')::uuid),
        quoted_detail->>'lead_source',
        'Undefined'
      ),
      -- Map items_quoted
      CASE 
        WHEN mapping_items_key IS NOT NULL THEN 
          COALESCE((quoted_detail->>mapping_items_key)::integer, 0)
        ELSE 
          COALESCE((quoted_detail->>'items_quoted')::integer, 0)
      END,
      -- Map policies_quoted  
      CASE 
        WHEN mapping_policies_key IS NOT NULL THEN
          CASE 
            WHEN LOWER(quoted_detail->>mapping_policies_key) IN ('yes', '1', 'true') THEN 1
            WHEN LOWER(quoted_detail->>mapping_policies_key) IN ('no', '0', 'false') THEN 0
            ELSE COALESCE((quoted_detail->>mapping_policies_key)::integer, 0)
          END
        ELSE 
          COALESCE((quoted_detail->>'policies_quoted')::integer, 0)
      END,
      -- Map premium_potential_cents
      CASE 
        WHEN mapping_premium_key IS NOT NULL THEN
          CASE 
            WHEN quoted_detail->>mapping_premium_key ~ '^\$?[0-9]+(\.[0-9]{2})?$' THEN
              (REPLACE(REPLACE(quoted_detail->>mapping_premium_key, '$', ''), ',', '')::numeric * 100)::bigint
            ELSE 
              COALESCE((quoted_detail->>mapping_premium_key)::bigint, 0)
          END
        ELSE 
          COALESCE((quoted_detail->>'premium_potential_cents')::bigint, 0)
      END,
      -- Store notes and other extras
      jsonb_build_object(
        'notes', COALESCE(
          CASE WHEN mapping_notes_key IS NOT NULL THEN quoted_detail->>mapping_notes_key END,
          quoted_detail->>'detailed_notes'
        ),
        'original_data', quoted_detail
      ),
      now()
    );
  END LOOP;

  -- Log the mapping usage
  INSERT INTO field_mapping_audit (
    submission_id,
    form_template_id,
    agency_id,
    mappings_used,
    created_at
  ) VALUES (
    p_submission_id,
    submission_rec.form_template_id,
    submission_rec.agency_id,
    form_mappings != '{}'::jsonb,
    now()
  );

END;
$function$;

-- 5) Backfill function for recent submissions
CREATE OR REPLACE FUNCTION public.backfill_quoted_details_for_agency(
  p_agency_id uuid,
  p_days_back integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  submission_rec record;
  processed_count integer := 0;
  error_count integer := 0;
  start_date date := current_date - interval '1 day' * p_days_back;
BEGIN
  -- Process recent final submissions for the agency
  FOR submission_rec IN
    SELECT DISTINCT s.id
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE ft.agency_id = p_agency_id
      AND s.final = true
      AND COALESCE(s.work_date, s.submission_date) >= start_date
      AND s.payload_json ? 'quoted_details'
    ORDER BY s.submitted_at DESC
  LOOP
    BEGIN
      PERFORM flatten_quoted_household_details_enhanced(submission_rec.id);
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error processing submission %: %', submission_rec.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', processed_count,
    'error_count', error_count,
    'agency_id', p_agency_id,
    'days_back', p_days_back
  );
END;
$function$;