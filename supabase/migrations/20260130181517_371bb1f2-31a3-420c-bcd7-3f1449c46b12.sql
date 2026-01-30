-- Drop and recreate the delete_kpi_transaction function
DROP FUNCTION IF EXISTS delete_kpi_transaction(uuid, text, uuid);

CREATE OR REPLACE FUNCTION delete_kpi_transaction(
  p_agency_id UUID,
  p_kpi_key TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpi_id UUID;
  v_deleted_targets INT := 0;
  v_deleted_metrics INT := 0;
BEGIN
  -- Get the KPI id
  SELECT id INTO v_kpi_id
  FROM kpis
  WHERE agency_id = p_agency_id AND key = p_kpi_key;
  
  IF v_kpi_id IS NULL THEN
    RAISE EXCEPTION 'KPI not found: %', p_kpi_key;
  END IF;
  
  -- Delete related targets
  DELETE FROM targets
  WHERE agency_id = p_agency_id AND metric_key = p_kpi_key;
  GET DIAGNOSTICS v_deleted_targets = ROW_COUNT;
  
  -- Delete from scorecard_rules arrays (selected_metrics, ring_metrics)
  UPDATE scorecard_rules
  SET 
    selected_metrics = array_remove(selected_metrics, p_kpi_key),
    ring_metrics = array_remove(ring_metrics, p_kpi_key),
    weights = weights - p_kpi_key,
    ring_colors = ring_colors - p_kpi_key,
    ring_labels = ring_labels - p_kpi_key
  WHERE agency_id = p_agency_id;
  
  -- Delete the KPI itself
  DELETE FROM kpis
  WHERE id = v_kpi_id;
  
  RETURN jsonb_build_object(
    'deleted_kpi', p_kpi_key,
    'deleted_targets', v_deleted_targets,
    'updated_scorecard_rules', true
  );
END;
$$;