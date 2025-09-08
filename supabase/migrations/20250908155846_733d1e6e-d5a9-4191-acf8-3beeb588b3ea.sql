-- Create the transactional delete KPI function
CREATE OR REPLACE FUNCTION public.delete_kpi_transaction(
  p_agency_id UUID,
  p_kpi_key TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_active_count INTEGER;
  forms_affected INTEGER := 0;
  rules_touched BOOLEAN := false;
  impact_summary JSONB;
BEGIN
  -- Validate agency access
  IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
    RAISE EXCEPTION 'Access denied to agency';
  END IF;

  -- 1) Check if after deletion, agency will still have ≥1 active KPI
  SELECT COUNT(*) INTO current_active_count
  FROM public.kpis 
  WHERE agency_id = p_agency_id AND is_active = true AND key != p_kpi_key;
  
  IF current_active_count < 1 THEN
    RAISE EXCEPTION 'Cannot delete KPI: Agency must have at least 1 active KPI';
  END IF;

  -- 2) Soft delete the KPI
  UPDATE public.kpis 
  SET is_active = false, effective_to = now()
  WHERE agency_id = p_agency_id AND key = p_kpi_key AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'KPI not found or already deleted';
  END IF;

  -- 3) Update scorecard_rules: remove key from selected_metrics and ring_metrics
  UPDATE public.scorecard_rules 
  SET 
    selected_metrics = array_remove(selected_metrics, p_kpi_key),
    ring_metrics = array_remove(ring_metrics, p_kpi_key),
    updated_at = now()
  WHERE agency_id = p_agency_id 
    AND (p_kpi_key = ANY(selected_metrics) OR p_kpi_key = ANY(ring_metrics));
    
  IF FOUND THEN
    rules_touched := true;
  END IF;

  -- 4) Update form_templates: set needs_attention=true where schema_json contains kpi_key
  -- This is a simplified check - in real implementation you'd parse JSON more thoroughly
  UPDATE public.form_templates 
  SET 
    needs_attention = true,
    form_kpi_version = form_kpi_version + 1,
    updated_at = now()
  WHERE agency_id = p_agency_id 
    AND (
      schema_json::text ILIKE '%"' || p_kpi_key || '"%' OR
      schema_json ? p_kpi_key
    );
    
  GET DIAGNOSTICS forms_affected = ROW_COUNT;

  -- 5) Insert audit record
  impact_summary := jsonb_build_object(
    'forms_affected', forms_affected,
    'rules_touched', rules_touched,
    'remaining_kpis', current_active_count
  );

  INSERT INTO public.kpi_audit (agency_id, kpi_key, action, actor_id, payload)
  VALUES (p_agency_id, p_kpi_key, 'deleted', p_actor_id, impact_summary);

  -- Return impact summary
  RETURN impact_summary;
END;
$$;