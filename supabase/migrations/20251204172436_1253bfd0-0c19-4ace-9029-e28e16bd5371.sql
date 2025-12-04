-- Migration: Fix flatten_quoted_household_details_enhanced and vw_submission_metrics
-- Part 1: Fix flatten_quoted_household_details_enhanced function
-- Changes: date → work_date, v_submission.date → COALESCE(v_submission.work_date, v_submission.submission_date)

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission RECORD;
  v_form_template RECORD;
  v_field_mappings JSONB;
  v_quoted_details JSONB;
  v_detail JSONB;
  v_household_name_key TEXT;
  v_lead_source_key TEXT;
  v_items_quoted_key TEXT;
  v_policies_quoted_key TEXT;
  v_premium_key TEXT;
  v_household_name TEXT;
  v_lead_source TEXT;
  v_items_quoted INTEGER;
  v_policies_quoted INTEGER;
  v_premium_cents INTEGER;
  v_premium_value NUMERIC;
  v_agency_id UUID;
BEGIN
  -- Get submission data
  SELECT s.*, ft.agency_id INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;
  
  IF v_submission IS NULL THEN
    RAISE NOTICE 'Submission not found: %', p_submission_id;
    RETURN;
  END IF;
  
  v_agency_id := v_submission.agency_id;
  
  -- Get form template with field mappings
  SELECT * INTO v_form_template
  FROM form_templates
  WHERE id = v_submission.form_template_id;
  
  IF v_form_template IS NULL THEN
    RAISE NOTICE 'Form template not found for submission: %', p_submission_id;
    RETURN;
  END IF;
  
  v_field_mappings := v_form_template.field_mappings;
  
  -- Extract quoted_details from payload (snake_case key)
  v_quoted_details := v_submission.payload_json -> 'quoted_details';
  
  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RAISE NOTICE 'No quoted_details found in submission: %', p_submission_id;
    RETURN;
  END IF;
  
  -- Get field mapping keys with fallbacks
  v_household_name_key := COALESCE(v_field_mappings -> 'quoted_details' ->> 'household_name', 'prospect_name');
  v_lead_source_key := COALESCE(v_field_mappings -> 'quoted_details' ->> 'lead_source', 'lead_source_label');
  v_items_quoted_key := COALESCE(v_field_mappings -> 'quoted_details' ->> 'items_quoted', 'items_quoted');
  v_policies_quoted_key := COALESCE(v_field_mappings -> 'quoted_details' ->> 'policies_quoted', 'policies_quoted');
  v_premium_key := COALESCE(v_field_mappings -> 'quoted_details' ->> 'premium_potential', 'premium_potential');
  
  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;
  
  -- Process each quoted detail
  FOR v_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    -- Extract values using mapped keys with fallbacks
    v_household_name := COALESCE(
      v_detail ->> v_household_name_key,
      v_detail ->> 'prospect_name',
      v_detail ->> 'household_name',
      'Unknown'
    );
    
    v_lead_source := COALESCE(
      v_detail ->> v_lead_source_key,
      v_detail ->> 'lead_source_label',
      v_detail ->> 'lead_source',
      'Unknown'
    );
    
    -- Extract items_quoted
    v_items_quoted := COALESCE(
      (v_detail ->> v_items_quoted_key)::INTEGER,
      (v_detail ->> 'items_quoted')::INTEGER,
      0
    );
    
    -- Extract policies_quoted
    v_policies_quoted := COALESCE(
      (v_detail ->> v_policies_quoted_key)::INTEGER,
      (v_detail ->> 'policies_quoted')::INTEGER,
      0
    );
    
    -- Extract premium and convert to cents
    v_premium_value := COALESCE(
      (v_detail ->> v_premium_key)::NUMERIC,
      (v_detail ->> 'premium_potential')::NUMERIC,
      0
    );
    v_premium_cents := ROUND(v_premium_value * 100)::INTEGER;
    
    -- Apply title case to household name
    v_household_name := initcap(v_household_name);
    
    -- Insert into quoted_household_details
    -- FIX: Changed 'date' to 'work_date' and 'v_submission.date' to 'COALESCE(v_submission.work_date, v_submission.submission_date)'
    INSERT INTO quoted_household_details (
      submission_id,
      team_member_id,
      agency_id,
      work_date,
      household_name,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      extras
    ) VALUES (
      p_submission_id,
      v_submission.team_member_id,
      v_agency_id,
      COALESCE(v_submission.work_date, v_submission.submission_date),
      v_household_name,
      v_lead_source,
      v_items_quoted,
      v_policies_quoted,
      v_premium_cents,
      jsonb_build_object('raw_json', v_detail)
    );
  END LOOP;
  
  RAISE NOTICE 'Successfully flattened quoted details for submission: %', p_submission_id;
END;
$function$;

-- Part 2: Fix vw_submission_metrics view
-- Changes: camelCase keys → snake_case keys

CREATE OR REPLACE VIEW vw_submission_metrics AS
SELECT 
  id AS submission_id,
  COALESCE(((payload_json -> 'outbound_calls'::text)::text)::integer, 0) AS outbound_calls,
  COALESCE(((payload_json -> 'talk_minutes'::text)::text)::integer, 0) AS talk_minutes,
  COALESCE(((payload_json -> 'quoted_count'::text)::text)::integer, 0) AS quoted_count,
  COALESCE(((payload_json -> 'sold_items'::text)::text)::integer, 0) AS sold_items
FROM submissions s;

-- Part 3: Re-process the stuck submission
-- This will trigger the corrected flatten function via the existing trigger
UPDATE submissions SET final = true WHERE id = 'd4e23609-1a8e-4001-a6f4-c3759dcd3658';