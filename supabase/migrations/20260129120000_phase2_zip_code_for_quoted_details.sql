-- ============================================================================
-- Phase 2: Add zip_code to quotedDetails for LQS sync
--
-- This enables scorecard-submitted quoted households to be synced to
-- lqs_households using the same household_key format (LASTNAME_FIRSTNAME_ZIP)
-- ============================================================================

-- Step 1: Add zip_code as a system-required sticky field for quotedDetails
INSERT INTO public.form_section_field_types (
  section_type,
  field_key,
  field_label,
  field_type,
  is_sticky,
  is_system_required,
  order_index
)
VALUES (
  'quotedDetails',
  'zip_code',
  'Zip Code',
  'text',
  true,   -- sticky: persists value between entries
  true,   -- system_required: always included in this section
  3       -- order: after prospect_name (1), lead_source (2), before items_quoted (4)
)
ON CONFLICT (section_type, field_key)
DO UPDATE SET
  is_sticky = EXCLUDED.is_sticky,
  is_system_required = EXCLUDED.is_system_required,
  order_index = EXCLUDED.order_index;


-- Step 2: Update the flattener function to extract and store zip_code
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
  v_zip_code TEXT;  -- Added for Phase 2
  v_items_quoted INTEGER;
  v_policies_quoted INTEGER;
  v_premium_cents INTEGER;
  v_premium_value NUMERIC;
  v_premium_raw TEXT;
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

    -- Extract zip_code (Phase 2 addition)
    v_zip_code := COALESCE(
      v_detail ->> 'zip_code',
      v_detail ->> 'zipCode',
      NULL
    );

    -- Extract items_quoted (handle comma-formatted strings)
    BEGIN
      v_items_quoted := COALESCE(
        REPLACE(v_detail ->> v_items_quoted_key, ',', '')::INTEGER,
        REPLACE(v_detail ->> 'items_quoted', ',', '')::INTEGER,
        0
      );
    EXCEPTION WHEN OTHERS THEN
      v_items_quoted := 0;
    END;

    -- Extract policies_quoted (handle comma-formatted strings)
    BEGIN
      v_policies_quoted := COALESCE(
        REPLACE(v_detail ->> v_policies_quoted_key, ',', '')::INTEGER,
        REPLACE(v_detail ->> 'policies_quoted', ',', '')::INTEGER,
        0
      );
    EXCEPTION WHEN OTHERS THEN
      v_policies_quoted := 0;
    END;

    -- Extract premium and convert to cents (FIX: strip commas from formatted numbers like "1,240.23")
    v_premium_raw := COALESCE(
      v_detail ->> v_premium_key,
      v_detail ->> 'premium_potential',
      '0'
    );
    -- Remove commas, dollar signs, and spaces from the raw value
    v_premium_raw := REPLACE(REPLACE(REPLACE(v_premium_raw, ',', ''), '$', ''), ' ', '');
    BEGIN
      v_premium_value := v_premium_raw::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_premium_value := 0;
    END;
    v_premium_cents := ROUND(v_premium_value * 100)::INTEGER;

    -- Apply title case to household name
    v_household_name := initcap(v_household_name);

    -- Insert into quoted_household_details (now includes zip_code)
    INSERT INTO quoted_household_details (
      submission_id,
      team_member_id,
      agency_id,
      work_date,
      household_name,
      zip_code,  -- Phase 2: Now populated
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
      v_zip_code,  -- Phase 2: Now populated
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
