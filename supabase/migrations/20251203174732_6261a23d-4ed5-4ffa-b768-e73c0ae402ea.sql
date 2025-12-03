-- Drop existing function first due to return type mismatch
DROP FUNCTION IF EXISTS public.flatten_quoted_household_details_enhanced(uuid);

-- Fix field mapping path: repeater->quotedDetails instead of quoted_details
-- Fix premium key: premium_potential_cents instead of premium_potential
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
  v_form_template_id uuid;
  v_payload jsonb;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_field_mappings jsonb;
  v_quoted_mappings jsonb;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_items_val int;
  v_policies_val int;
  v_premium_val int;
  v_household_name text;
BEGIN
  -- Get submission data with CORRECT column name
  SELECT 
    ft.agency_id,
    s.form_template_id,
    s.payload_json,
    ft.field_mappings
  INTO v_agency_id, v_form_template_id, v_payload, v_field_mappings
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission;

  IF v_payload IS NULL THEN
    RAISE NOTICE 'No payload found for submission %', p_submission;
    RETURN;
  END IF;

  -- Get quoted_details array with CORRECT key (snake_case)
  v_quoted_details := v_payload->'quoted_details';
  
  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RAISE NOTICE 'No quoted_details found for submission %', p_submission;
    RETURN;
  END IF;

  -- Get field mappings - try BOTH paths for compatibility
  -- First try: repeater->quotedDetails (current format)
  v_quoted_mappings := v_field_mappings->'repeater'->'quotedDetails';
  
  -- Fallback: quoted_details (legacy format)
  IF v_quoted_mappings IS NULL THEN
    v_quoted_mappings := v_field_mappings->'quoted_details';
  END IF;
  
  IF v_quoted_mappings IS NOT NULL THEN
    v_items_field := v_quoted_mappings->>'items_quoted';
    v_policies_field := v_quoted_mappings->>'policies_quoted';
    v_premium_field := v_quoted_mappings->>'premium_potential_cents';
    RAISE NOTICE 'Using field mappings - items: %, policies: %, premium: %', 
      v_items_field, v_policies_field, v_premium_field;
  ELSE
    RAISE NOTICE 'No field mappings found, using defaults';
  END IF;

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission;

  -- Process each quoted detail with CORRECT FOR loop pattern
  FOR v_current_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    -- Extract household name
    v_household_name := COALESCE(
      v_current_detail->>'household_name',
      v_current_detail->>'householdName',
      'Unknown'
    );

    -- Extract values using field mappings or defaults
    IF v_items_field IS NOT NULL AND v_current_detail ? v_items_field THEN
      v_items_val := COALESCE((v_current_detail->>v_items_field)::int, 0);
    ELSE
      v_items_val := COALESCE(
        (v_current_detail->>'items_quoted')::int,
        (v_current_detail->>'itemsQuoted')::int,
        0
      );
    END IF;

    IF v_policies_field IS NOT NULL AND v_current_detail ? v_policies_field THEN
      v_policies_val := COALESCE((v_current_detail->>v_policies_field)::int, 0);
    ELSE
      v_policies_val := COALESCE(
        (v_current_detail->>'policies_quoted')::int,
        (v_current_detail->>'policiesQuoted')::int,
        0
      );
    END IF;

    IF v_premium_field IS NOT NULL AND v_current_detail ? v_premium_field THEN
      v_premium_val := COALESCE((v_current_detail->>v_premium_field)::int, 0);
    ELSE
      v_premium_val := COALESCE(
        (v_current_detail->>'premium_potential_cents')::int,
        (v_current_detail->>'premiumPotentialCents')::int,
        (v_current_detail->>'premium_potential')::int,
        0
      );
    END IF;

    RAISE NOTICE 'Processing: % - items: %, policies: %, premium: %',
      v_household_name, v_items_val, v_policies_val, v_premium_val;

    -- Insert record
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      household_name,
      items_quoted,
      policies_quoted,
      premium_potential_cents
    ) VALUES (
      p_submission,
      v_agency_id,
      v_household_name,
      v_items_val,
      v_policies_val,
      v_premium_val
    );
  END LOOP;

  RAISE NOTICE 'Completed flattening for submission %', p_submission;
END;
$function$;