-- Drop existing function first due to return type mismatch
DROP FUNCTION IF EXISTS public.flatten_quoted_household_details_enhanced(uuid);

-- Recreate with fixed premium casting (NUMERIC->ROUND->INT for decimals)
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS TABLE(
  id uuid,
  submission_id uuid,
  household_name text,
  lead_source_label text,
  items_quoted integer,
  policies_quoted integer,
  premium_potential_cents integer,
  extras jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_field_mappings jsonb;
  v_quoted_mappings jsonb;
  v_repeater_key text;
  v_household_field text;
  v_lead_source_field text;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_household_name text;
  v_lead_source text;
  v_items int;
  v_policies int;
  v_premium_cents int;
  v_extras jsonb;
  v_new_id uuid;
BEGIN
  -- Get submission with form template
  SELECT s.*, ft.field_mappings, ft.schema_json
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RAISE EXCEPTION 'Submission not found: %', p_submission_id;
  END IF;

  v_field_mappings := v_submission.field_mappings;

  -- Try both possible paths: repeater->quotedDetails (new) or quoted_details (legacy)
  v_quoted_mappings := v_field_mappings->'repeater'->'quotedDetails';
  IF v_quoted_mappings IS NULL THEN
    v_quoted_mappings := v_field_mappings->'quoted_details';
  END IF;

  -- Get field mappings for quoted details section
  IF v_quoted_mappings IS NOT NULL THEN
    v_repeater_key := v_quoted_mappings->>'repeater_key';
    v_household_field := v_quoted_mappings->>'household_name';
    v_lead_source_field := v_quoted_mappings->>'lead_source';
    v_items_field := v_quoted_mappings->>'items_quoted';
    v_policies_field := v_quoted_mappings->>'policies_quoted';
    v_premium_field := v_quoted_mappings->>'premium_potential_cents';
  ELSE
    -- Fallback to default field names
    v_repeater_key := 'quotedDetails';
    v_household_field := 'householdName';
    v_lead_source_field := 'leadSource';
    v_items_field := 'itemsQuoted';
    v_policies_field := 'policiesQuoted';
    v_premium_field := 'premiumPotential';
  END IF;

  -- Get the quoted details array from payload
  v_quoted_details := v_submission.payload_json->v_repeater_key;

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN;
  END IF;

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE quoted_household_details.submission_id = p_submission_id;

  -- Process each quoted detail
  FOR v_current_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    v_household_name := v_current_detail->>v_household_field;
    v_lead_source := v_current_detail->>v_lead_source_field;
    
    -- Parse numeric fields with defaults
    v_items := COALESCE((v_current_detail->>v_items_field)::int, 0);
    v_policies := COALESCE((v_current_detail->>v_policies_field)::int, 0);
    
    -- Handle premium - cast to NUMERIC first to handle decimals, multiply by 100, round, then cast to INT
    v_premium_cents := COALESCE(ROUND((v_current_detail->>v_premium_field)::numeric * 100)::int, 0);

    -- Store any extra fields not in standard mapping
    v_extras := v_current_detail - ARRAY[v_household_field, v_lead_source_field, v_items_field, v_policies_field, v_premium_field];

    v_new_id := gen_random_uuid();

    INSERT INTO quoted_household_details (
      id,
      submission_id,
      household_name,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      extras,
      created_at
    ) VALUES (
      v_new_id,
      p_submission_id,
      v_household_name,
      v_lead_source,
      v_items,
      v_policies,
      v_premium_cents,
      v_extras,
      now()
    );

    -- Return the inserted row
    id := v_new_id;
    submission_id := p_submission_id;
    household_name := v_household_name;
    lead_source_label := v_lead_source;
    items_quoted := v_items;
    policies_quoted := v_policies;
    premium_potential_cents := v_premium_cents;
    extras := v_extras;
    created_at := now();
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;