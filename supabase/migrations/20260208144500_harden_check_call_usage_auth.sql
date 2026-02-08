-- Harden check_and_reset_call_usage against cross-agency parameter tampering.
-- Enforces deny-by-default with owner/auth path and optional staff-session path.

DROP FUNCTION IF EXISTS public.check_and_reset_call_usage(uuid);

CREATE OR REPLACE FUNCTION public.check_and_reset_call_usage(
  p_agency_id uuid,
  p_staff_session_token text DEFAULT NULL
)
RETURNS TABLE(calls_used integer, calls_limit integer, period_end date, should_reset boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_usage RECORD;
  v_current_period_start DATE;
  v_current_period_end DATE;
  v_today DATE := CURRENT_DATE;
  v_reset_day INTEGER;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSIF p_staff_session_token IS NOT NULL THEN
    IF public.verify_staff_session(p_staff_session_token, p_agency_id) IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- Get agency settings
  SELECT * INTO v_settings
  FROM public.agency_call_scoring_settings
  WHERE agency_id = p_agency_id;

  IF v_settings IS NULL THEN
    -- No settings, return defaults
    RETURN QUERY
      SELECT 0, 20, (DATE_TRUNC('month', v_today) + INTERVAL '1 month')::DATE, false;
    RETURN;
  END IF;

  v_reset_day := COALESCE(v_settings.reset_day, 1);

  -- Calculate current period based on reset_day
  IF EXTRACT(DAY FROM v_today) >= v_reset_day THEN
    v_current_period_start := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
    v_current_period_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month')::DATE + (v_reset_day - 1);
  ELSE
    v_current_period_start := (DATE_TRUNC('month', v_today) - INTERVAL '1 month')::DATE + (v_reset_day - 1);
    v_current_period_end := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
  END IF;

  -- Get or create usage record for current period
  SELECT * INTO v_usage
  FROM public.call_usage_tracking
  WHERE call_usage_tracking.agency_id = p_agency_id
    AND call_usage_tracking.period_start = v_current_period_start;

  IF v_usage IS NULL THEN
    -- Create new period record (this effectively resets the count)
    INSERT INTO public.call_usage_tracking (
      agency_id, calls_used, calls_limit, period_start, period_end, reset_day, billing_period_start, billing_period_end
    )
    VALUES (
      p_agency_id, 0, v_settings.calls_limit, v_current_period_start, v_current_period_end, v_reset_day, v_current_period_start, v_current_period_end
    )
    RETURNING * INTO v_usage;

    RETURN QUERY
      SELECT v_usage.calls_used, v_usage.calls_limit, v_usage.period_end, true;
  ELSE
    RETURN QUERY
      SELECT v_usage.calls_used, v_usage.calls_limit, v_usage.period_end, false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_reset_call_usage(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_reset_call_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_reset_call_usage(uuid, text) TO anon;
