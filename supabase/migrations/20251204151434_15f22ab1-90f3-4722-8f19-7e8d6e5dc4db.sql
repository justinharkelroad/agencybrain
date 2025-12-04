-- Step 1: Add 3 system required sticky fields to form_section_field_types
INSERT INTO form_section_field_types 
  (section_type, field_key, field_label, field_type, is_sticky, is_system_required, order_index)
VALUES 
  ('quotedDetails', 'items_quoted', '# Items Quoted', 'number', true, true, 4),
  ('quotedDetails', 'policies_quoted', '# Policies Quoted', 'number', true, true, 5),
  ('quotedDetails', 'premium_potential', 'Premium Potential ($)', 'currency', true, true, 6)
ON CONFLICT DO NOTHING;

-- Step 2: Drop and recreate flatten function with direct key fallbacks
DROP FUNCTION IF EXISTS flatten_quoted_household_details_enhanced(uuid);

CREATE FUNCTION flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission record;
  v_agency_id uuid;
  v_payload jsonb;
  v_quoted_details jsonb;
  v_mappings jsonb;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_household_field text;
  v_lead_source_field text;
  v_detail jsonb;
  v_household_name text;
  v_lead_source_label text;
  v_items_val int;
  v_policies_val int;
  v_premium_val bigint;
  v_extras jsonb;
BEGIN
  -- Get submission with form template for agency_id
  SELECT s.*, ft.agency_id, ft.field_mappings
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Submission not found: %', p_submission_id;
    RETURN;
  END IF;

  v_agency_id := v_submission.agency_id;
  v_payload := v_submission.payload_json;
  v_mappings := v_submission.field_mappings;

  -- Get quoted_details from payload (snake_case key)
  v_quoted_details := v_payload->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RAISE NOTICE 'No quoted_details in submission %', p_submission_id;
    RETURN;
  END IF;

  -- Extract field mappings if available (fallback approach)
  v_items_field := COALESCE(v_mappings->'repeater'->'quotedDetails'->>'items_quoted', 'items_quoted');
  v_policies_field := COALESCE(v_mappings->'repeater'->'quotedDetails'->>'policies_quoted', 'policies_quoted');
  v_premium_field := COALESCE(v_mappings->'repeater'->'quotedDetails'->>'premium_potential_cents', v_mappings->'repeater'->'quotedDetails'->>'premium_potential', 'premium_potential');
  v_household_field := COALESCE(v_mappings->'repeater'->'quotedDetails'->>'household_name', 'prospect_name');
  v_lead_source_field := COALESCE(v_mappings->'repeater'->'quotedDetails'->>'lead_source', 'lead_source_label');

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail
  FOR v_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    -- Get household name: direct key first, then mapped field
    v_household_name := COALESCE(
      v_detail->>'prospect_name',
      v_detail->>v_household_field,
      'Unknown'
    );
    
    -- Get lead source: direct key first, then mapped field
    v_lead_source_label := COALESCE(
      v_detail->>'lead_source_label',
      v_detail->>v_lead_source_field,
      'Unknown'
    );

    -- Get items: DIRECT KEY FIRST (items_quoted), then mapped field
    v_items_val := COALESCE(
      (v_detail->>'items_quoted')::int,
      (v_detail->>v_items_field)::int,
      0
    );

    -- Get policies: DIRECT KEY FIRST (policies_quoted), then mapped field
    v_policies_val := COALESCE(
      (v_detail->>'policies_quoted')::int,
      (v_detail->>v_policies_field)::int,
      0
    );

    -- Get premium: DIRECT KEY FIRST (premium_potential in dollars), then mapped field
    -- Multiply by 100 to convert dollars to cents
    v_premium_val := COALESCE(
      ROUND((v_detail->>'premium_potential')::numeric * 100),
      ROUND((v_detail->>v_premium_field)::numeric * 100),
      0
    )::bigint;

    -- Build extras with raw JSON for reference
    v_extras := jsonb_build_object('raw_json', v_detail);

    -- Insert the flattened record
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      date,
      household_name,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      extras
    )
    VALUES (
      p_submission_id,
      v_agency_id,
      v_submission.team_member_id,
      v_submission.date,
      initcap(v_household_name),
      v_lead_source_label,
      v_items_val,
      v_policies_val,
      v_premium_val,
      v_extras
    );
  END LOOP;

  -- Log audit entry
  INSERT INTO field_mapping_audit (
    submission_id,
    form_template_id,
    agency_id,
    mappings_used,
    items_extracted,
    policies_extracted,
    premium_extracted
  )
  SELECT
    p_submission_id,
    v_submission.form_template_id,
    v_agency_id,
    v_mappings IS NOT NULL AND v_mappings->'repeater'->'quotedDetails' IS NOT NULL,
    SUM((value->>'items_quoted')::int),
    SUM((value->>'policies_quoted')::int),
    SUM(ROUND((value->>'premium_potential')::numeric * 100))::bigint
  FROM jsonb_array_elements(v_quoted_details);

  RAISE NOTICE 'Flattened % quoted details for submission %', jsonb_array_length(v_quoted_details), p_submission_id;
END;
$$;

-- Step 3: Auto-clean existing forms - remove dynamic fields that match sticky field labels
UPDATE form_templates
SET schema_json = jsonb_set(
  schema_json,
  '{repeaterSections,quotedDetails,fields}',
  COALESCE(
    (
      SELECT jsonb_agg(field)
      FROM jsonb_array_elements(schema_json->'repeaterSections'->'quotedDetails'->'fields') AS field
      WHERE (
        (field->>'isSticky')::boolean = true 
        OR NOT (
          field->>'label' ILIKE '%items quoted%'
          OR field->>'label' ILIKE '%policies quoted%'
          OR field->>'label' ILIKE '%premium%'
        )
      )
    ),
    '[]'::jsonb
  )
)
WHERE schema_json->'repeaterSections'->'quotedDetails'->'fields' IS NOT NULL
  AND jsonb_array_length(schema_json->'repeaterSections'->'quotedDetails'->'fields') > 0;

-- Step 4: Clear field_mappings for quotedDetails (no longer needed)
UPDATE form_templates
SET field_mappings = CASE 
  WHEN field_mappings->'repeater' IS NOT NULL AND field_mappings->'repeater'->'quotedDetails' IS NOT NULL
  THEN jsonb_set(
    field_mappings,
    '{repeater}',
    (field_mappings->'repeater') - 'quotedDetails'
  )
  ELSE field_mappings
END
WHERE field_mappings->'repeater'->'quotedDetails' IS NOT NULL;