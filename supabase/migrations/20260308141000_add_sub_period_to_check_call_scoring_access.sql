-- Add subscription_period_start to check_call_scoring_access return type
-- So the frontend can compute the monthly reset date even when subscriptions table is empty
-- Must DROP first because return type is changing

DROP FUNCTION IF EXISTS public.check_call_scoring_access(uuid);

CREATE FUNCTION public.check_call_scoring_access(p_agency_id uuid)
RETURNS TABLE(
  can_score boolean,
  subscription_remaining integer,
  addon_remaining integer,
  purchased_remaining integer,
  bonus_remaining integer,
  total_remaining integer,
  message text,
  bonus_expires_at timestamptz,
  subscription_period_start date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance record;
  v_status text;
  v_is_unlimited boolean;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  SELECT subscription_status INTO v_status
  FROM public.agencies WHERE id = p_agency_id;

  v_is_unlimited := (v_status = '1on1_client');

  IF v_is_unlimited THEN
    RETURN QUERY SELECT
      TRUE,
      999999::integer,
      0::integer,
      0::integer,
      0::integer,
      999999::integer,
      'Unlimited call scoring'::text,
      NULL::timestamptz,
      NULL::date;
    RETURN;
  END IF;

  INSERT INTO public.agency_call_balance (agency_id, subscription_calls_limit, subscription_period_start)
  VALUES (p_agency_id, CASE WHEN v_status = 'active' THEN 20 WHEN v_status = 'trialing' THEN 3 ELSE 0 END, CURRENT_DATE)
  ON CONFLICT (agency_id) DO UPDATE
    SET subscription_period_start = COALESCE(agency_call_balance.subscription_period_start, CURRENT_DATE)
    WHERE agency_call_balance.subscription_period_start IS NULL;

  -- Auto-zero expired bonus calls
  UPDATE public.agency_call_balance
  SET bonus_calls_remaining = 0,
      bonus_calls_expires_at = NULL
  WHERE agency_id = p_agency_id
    AND bonus_calls_expires_at IS NOT NULL
    AND bonus_calls_expires_at <= now();

  SELECT * INTO v_balance
  FROM public.agency_call_balance
  WHERE agency_id = p_agency_id;

  DECLARE
    v_sub_remaining integer;
    v_addon integer;
    v_bonus integer;
    v_total integer;
  BEGIN
    v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));
    v_addon := COALESCE(v_balance.addon_calls_remaining, 0);
    v_bonus := COALESCE(v_balance.bonus_calls_remaining, 0);
    v_total := v_sub_remaining + v_addon + v_bonus + COALESCE(v_balance.purchased_calls_remaining, 0);

    RETURN QUERY SELECT
      (v_total > 0),
      v_sub_remaining,
      v_addon,
      COALESCE(v_balance.purchased_calls_remaining, 0),
      v_bonus,
      v_total,
      CASE
        WHEN v_total > 0 THEN format('%s calls remaining', v_total)
        WHEN v_status = 'trialing' THEN 'Trial call scores used. Upgrade to continue.'
        ELSE 'No calls remaining. Purchase a call pack to continue.'
      END,
      v_balance.bonus_calls_expires_at,
      v_balance.subscription_period_start;
  END;
END;
$$;

-- Preserve existing grants
REVOKE EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO anon;
