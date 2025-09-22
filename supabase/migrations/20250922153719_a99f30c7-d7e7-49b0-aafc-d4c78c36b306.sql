-- Create/update view for metrics with team member names
CREATE OR REPLACE VIEW public.vw_metrics_with_team AS
SELECT md.*,
       COALESCE(tm.display_name, CONCAT(tm.first_name, ' ', tm.last_name), tm.name, 'Unassigned') AS rep_name
FROM public.metrics_daily md
LEFT JOIN public.team_members tm
  ON tm.id = md.team_member_id
 AND tm.agency_id = md.agency_id;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_flatten_quoted_household_details ON public.submissions;

-- Create enhanced flattener function that handles notes properly
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  form_mappings jsonb;
  notes_key text;
  policies_key text;
  items_key text;
  premium_key text;
  extracted_notes text;
  extracted_policies integer;
  extracted_items integer;
  extracted_premium bigint;
  qhd_row record;
BEGIN
  -- Skip if not final submission
  IF NOT COALESCE(NEW.final, true) THEN
    RETURN NEW;
  END IF;

  -- Get field mappings from form template
  SELECT field_mappings INTO form_mappings
  FROM form_templates 
  WHERE id = NEW.form_template_id;

  -- Extract mapping keys
  notes_key := form_mappings->'quoted_details'->>'notes';
  policies_key := form_mappings->'quoted_details'->>'policies_quoted';
  items_key := form_mappings->'quoted_details'->>'items_quoted';
  premium_key := form_mappings->'quoted_details'->>'premium_potential_cents';

  -- Process each quoted household detail row
  FOR qhd_row IN 
    SELECT * FROM jsonb_array_elements(NEW.payload_json->'quotedDetails') AS qd
  LOOP
    -- Extract notes with fallback chain
    extracted_notes := COALESCE(
      qhd_row.qd->>notes_key,
      qhd_row.qd->>'detailed_notes', 
      qhd_row.qd->>'notes'
    );

    -- Extract policies_quoted with smart parsing
    extracted_policies := CASE
      WHEN (qhd_row.qd->>policies_key) ILIKE 'yes' THEN 1
      WHEN (qhd_row.qd->>policies_key) = '1' THEN 1
      WHEN (qhd_row.qd->>policies_key) ILIKE 'no' THEN 0
      WHEN (qhd_row.qd->>policies_key) = '0' THEN 0
      WHEN (qhd_row.qd->>policies_key) ~ '^\s*\d+\s*$' THEN (qhd_row.qd->>policies_key)::int
      ELSE NULL
    END;

    -- Extract items_quoted
    extracted_items := CASE
      WHEN (qhd_row.qd->>items_key) ~ '^\s*\d+\s*$' THEN (qhd_row.qd->>items_key)::int
      ELSE NULL
    END;

    -- Extract premium_potential_cents (handle dollars -> cents conversion)
    extracted_premium := CASE
      WHEN (qhd_row.qd->>premium_key) ~ '^\s*\d+\.\d{1,2}\s*$' THEN
        ROUND(100 * (qhd_row.qd->>premium_key)::numeric)::bigint
      WHEN (qhd_row.qd->>premium_key) ~ '^\s*\d+\s*$' THEN
        (qhd_row.qd->>premium_key)::bigint
      ELSE NULL
    END;

    -- Update quoted_household_details with extracted data
    UPDATE quoted_household_details
    SET 
      items_quoted = extracted_items,
      policies_quoted = extracted_policies,
      premium_potential_cents = extracted_premium,
      extras = jsonb_set(
        COALESCE(extras, '{}'), 
        '{detailed_notes}', 
        to_jsonb(extracted_notes)
      )
    WHERE submission_id = NEW.id
      AND household_name = qhd_row.qd->>'household_name';
  END LOOP;

  RETURN NEW;
END $$;

-- Create new trigger using enhanced function
CREATE TRIGGER trg_flatten_quoted_household_details
AFTER INSERT OR UPDATE OF payload_json ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.flatten_quoted_household_details_enhanced();