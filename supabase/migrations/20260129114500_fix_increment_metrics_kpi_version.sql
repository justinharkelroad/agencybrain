-- Fix increment_metrics_quoted_count to handle kpi_version constraint
-- The metrics_daily table requires kpi_version_id and label_at_submit to be non-null

CREATE OR REPLACE FUNCTION increment_metrics_quoted_count(
  p_agency_id uuid,
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpi_version_id uuid;
  v_label_at_submit text;
  v_updated_count int;
BEGIN
  -- Skip if no team member assigned
  IF p_team_member_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: Skipping - no team_member_id';
    RETURN;
  END IF;

  -- First, try to UPDATE existing row (most common case - scorecard already submitted)
  UPDATE metrics_daily
  SET
    quoted_count = COALESCE(quoted_count, 0) + 1,
    updated_at = now()
  WHERE team_member_id = p_team_member_id
    AND date = p_date;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RAISE LOG 'increment_metrics_quoted_count: Updated existing row for team_member=%, date=%', p_team_member_id, p_date;
    RETURN;
  END IF;

  -- No existing row - need to INSERT with kpi_version_id
  -- Find a valid kpi_version for this agency (get the most recent active one)
  SELECT kv.id, kv.label
  INTO v_kpi_version_id, v_label_at_submit
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = p_agency_id
    AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  -- If no kpi_version found, try to get any active kpi_version for the agency via form bindings
  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = p_agency_id
      AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC
    LIMIT 1;
  END IF;

  -- If still no kpi_version, we cannot insert (constraint would fail)
  -- Just log and return - the quote is still created, just not counted in metrics
  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: No kpi_version found for agency=%, skipping metrics insert', p_agency_id;
    RETURN;
  END IF;

  -- Insert new metrics_daily row with required fields
  INSERT INTO metrics_daily (
    agency_id,
    team_member_id,
    date,
    quoted_count,
    kpi_version_id,
    label_at_submit
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_date,
    1,
    v_kpi_version_id,
    v_label_at_submit
  );

  RAISE LOG 'increment_metrics_quoted_count: Inserted new row for team_member=%, date=%, kpi_version=%',
    p_team_member_id, p_date, v_kpi_version_id;
END;
$$;
