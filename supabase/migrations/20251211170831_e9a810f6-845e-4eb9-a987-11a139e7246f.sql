-- Create flatten_sold_household_details_enhanced function
CREATE OR REPLACE FUNCTION flatten_sold_household_details_enhanced(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_sold_row JSONB;
  v_lead_source_uuid UUID;
  v_lead_source_name TEXT;
  v_policy_holder_name TEXT;
  v_premium_cents BIGINT;
  v_premium_text TEXT;
  v_num_items INTEGER;
BEGIN
  -- Get submission data with agency_id from form_templates
  SELECT s.*, ft.agency_id INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RAISE NOTICE 'Submission not found: %', p_submission_id;
    RETURN;
  END IF;

  -- Check if soldDetails exists
  IF v_submission.payload_json->'soldDetails' IS NULL 
     OR jsonb_array_length(COALESCE(v_submission.payload_json->'soldDetails', '[]'::jsonb)) = 0 THEN
    RAISE NOTICE 'No soldDetails found in submission: %', p_submission_id;
    RETURN;
  END IF;

  -- Delete existing sold details for this submission (idempotent)
  DELETE FROM sold_policy_details WHERE submission_id = p_submission_id;

  -- Process each sold detail row
  FOR v_sold_row IN SELECT value FROM jsonb_array_elements(v_submission.payload_json->'soldDetails')
  LOOP
    -- Look up lead source label if UUID provided
    v_lead_source_uuid := NULL;
    v_lead_source_name := NULL;
    
    -- Try to get lead_source_id first, then fall back to lead_source
    IF v_sold_row->>'lead_source_id' IS NOT NULL THEN
      BEGIN
        v_lead_source_uuid := (v_sold_row->>'lead_source_id')::uuid;
        SELECT name INTO v_lead_source_name FROM lead_sources WHERE id = v_lead_source_uuid;
      EXCEPTION WHEN OTHERS THEN
        v_lead_source_name := v_sold_row->>'lead_source_label';
      END;
    ELSIF v_sold_row->>'lead_source' IS NOT NULL THEN
      BEGIN
        v_lead_source_uuid := (v_sold_row->>'lead_source')::uuid;
        SELECT name INTO v_lead_source_name FROM lead_sources WHERE id = v_lead_source_uuid;
      EXCEPTION WHEN OTHERS THEN
        v_lead_source_name := COALESCE(v_sold_row->>'lead_source_label', v_sold_row->>'lead_source');
      END;
    END IF;

    -- Extract policy holder name with title case
    v_policy_holder_name := initcap(COALESCE(
      v_sold_row->>'customer_name',
      v_sold_row->>'policy_holder_name',
      'Unknown'
    ));

    -- Extract premium and convert to cents (handle $ prefix and decimals)
    v_premium_text := v_sold_row->>'premium_sold';
    IF v_premium_text IS NOT NULL THEN
      v_premium_cents := ROUND(regexp_replace(v_premium_text, '[^0-9.]', '', 'g')::numeric * 100)::bigint;
    ELSE
      v_premium_cents := 0;
    END IF;

    -- Extract num_items
    v_num_items := COALESCE((v_sold_row->>'num_items')::integer, 0);

    -- Insert into sold_policy_details
    INSERT INTO sold_policy_details (
      submission_id,
      policy_holder_name,
      lead_source_id,
      policy_type,
      premium_amount_cents,
      extras
    ) VALUES (
      p_submission_id,
      v_policy_holder_name,
      v_lead_source_uuid,
      -- Handle policy_type as array (could be JSON array or single value)
      CASE 
        WHEN jsonb_typeof(v_sold_row->'policy_type') = 'array' 
        THEN ARRAY(SELECT jsonb_array_elements_text(v_sold_row->'policy_type'))
        WHEN v_sold_row->>'policy_type' IS NOT NULL 
        THEN ARRAY[v_sold_row->>'policy_type']
        ELSE NULL
      END,
      v_premium_cents,
      jsonb_build_object(
        'raw_json', v_sold_row,
        'lead_source_label', COALESCE(v_lead_source_name, v_sold_row->>'lead_source_label'),
        'num_items', v_num_items,
        'zip_code', v_sold_row->>'zip_code',
        'work_date', COALESCE(v_submission.work_date, v_submission.submission_date)
      )
    );
  END LOOP;
  
  RAISE NOTICE 'Successfully flattened sold details for submission: %', p_submission_id;
END;
$$;

-- Update the trigger function to also call flatten_sold_household_details_enhanced
CREATE OR REPLACE FUNCTION trigger_flatten_quoted_details_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process final submissions and ensure idempotence
  IF NEW.final = true THEN
    -- Call enhanced flattener for quoted details
    PERFORM flatten_quoted_household_details_enhanced(NEW.id);
    -- Call enhanced flattener for sold details
    PERFORM flatten_sold_household_details_enhanced(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;