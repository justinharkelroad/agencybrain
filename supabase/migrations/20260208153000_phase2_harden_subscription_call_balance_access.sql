-- Phase 2 (Batch 1): Harden subscription + call-balance access surface
-- - Enforce deny-by-default agency checks in tenant-facing SECURITY DEFINER RPCs
-- - Restrict sensitive mutating RPCs to service_role only
-- - Replace legacy profile-only RLS agency checks with has_agency_access()

-- =============================================================================
-- RLS policy hardening for billing/usage tables
-- =============================================================================

-- subscriptions
DROP POLICY IF EXISTS "Users can view their agency subscription" ON public.subscriptions;
CREATE POLICY "Users can view their agency subscription"
  ON public.subscriptions FOR SELECT
  USING (public.has_agency_access(auth.uid(), agency_id));

-- feature_usage
DROP POLICY IF EXISTS "Users can view their agency feature usage" ON public.feature_usage;
CREATE POLICY "Users can view their agency feature usage"
  ON public.feature_usage FOR SELECT
  USING (public.has_agency_access(auth.uid(), agency_id));

-- agency_call_balance
DROP POLICY IF EXISTS "Users can view their agency call balance" ON public.agency_call_balance;
CREATE POLICY "Users can view their agency call balance"
  ON public.agency_call_balance FOR SELECT
  USING (public.has_agency_access(auth.uid(), agency_id));

-- call_pack_purchases
DROP POLICY IF EXISTS "Users can view their agency purchases" ON public.call_pack_purchases;
CREATE POLICY "Users can view their agency purchases"
  ON public.call_pack_purchases FOR SELECT
  USING (public.has_agency_access(auth.uid(), agency_id));

-- =============================================================================
-- Function hardening: feature usage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_agency_id uuid,
  p_feature_key text,
  p_period_start date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date;
  v_new_count integer;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  v_period_start := COALESCE(p_period_start, date_trunc('month', CURRENT_DATE)::date);

  INSERT INTO public.feature_usage (agency_id, feature_key, period_start, usage_count, last_used_at)
  VALUES (p_agency_id, p_feature_key, v_period_start, 1, now())
  ON CONFLICT (agency_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = public.feature_usage.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  RETURNING usage_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_agency_id uuid,
  p_feature_key text
)
RETURNS TABLE(
  can_access boolean,
  access_type text,
  usage_limit integer,
  current_usage integer,
  remaining integer,
  upgrade_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_status text;
  v_limit_record record;
  v_current_usage integer;
  v_period_start date;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  SELECT COALESCE(a.subscription_status, 'none') INTO v_subscription_status
  FROM public.agencies a
  WHERE a.id = p_agency_id;

  IF v_subscription_status IS NULL OR v_subscription_status = 'none' THEN
    RETURN QUERY SELECT
      FALSE::boolean,
      'none'::text,
      NULL::integer,
      0::integer,
      0::integer,
      'Please subscribe to access this feature.'::text;
    RETURN;
  END IF;

  SELECT * INTO v_limit_record
  FROM public.feature_limits fl
  WHERE fl.subscription_status = v_subscription_status
    AND fl.feature_key = p_feature_key;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE::boolean,
      'none'::text,
      NULL::integer,
      0::integer,
      0::integer,
      'Feature not available for your subscription.'::text;
    RETURN;
  END IF;

  IF v_limit_record.access_type = 'full' THEN
    RETURN QUERY SELECT
      TRUE::boolean,
      'full'::text,
      v_limit_record.usage_limit,
      0::integer,
      CASE WHEN v_limit_record.usage_limit = -1 THEN 999999 ELSE v_limit_record.usage_limit END,
      NULL::text;
    RETURN;
  ELSIF v_limit_record.access_type = 'none' THEN
    RETURN QUERY SELECT
      FALSE::boolean,
      'none'::text,
      v_limit_record.usage_limit,
      0::integer,
      0::integer,
      v_limit_record.upgrade_message;
    RETURN;
  ELSIF v_limit_record.access_type = 'limited' THEN
    SELECT COALESCE(s.trial_start::date, date_trunc('month', CURRENT_DATE)::date)
    INTO v_period_start
    FROM public.subscriptions s
    WHERE s.agency_id = p_agency_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    v_period_start := COALESCE(v_period_start, date_trunc('month', CURRENT_DATE)::date);

    SELECT COALESCE(fu.usage_count, 0) INTO v_current_usage
    FROM public.feature_usage fu
    WHERE fu.agency_id = p_agency_id
      AND fu.feature_key = p_feature_key
      AND fu.period_start = v_period_start;

    v_current_usage := COALESCE(v_current_usage, 0);

    RETURN QUERY SELECT
      (v_current_usage < v_limit_record.usage_limit)::boolean,
      'limited'::text,
      v_limit_record.usage_limit,
      v_current_usage,
      GREATEST(0, v_limit_record.usage_limit - v_current_usage),
      v_limit_record.upgrade_message;
    RETURN;
  END IF;
END;
$$;

-- Webhook-only helper should never be callable by end users
CREATE OR REPLACE FUNCTION public.sync_subscription_status(
  p_stripe_subscription_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  SELECT agency_id INTO v_agency_id
  FROM public.subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  IF v_agency_id IS NOT NULL THEN
    UPDATE public.agencies
    SET subscription_status = p_status
    WHERE id = v_agency_id;
  END IF;
END;
$$;

-- =============================================================================
-- Function hardening: call-scoring balance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_call_scoring_access(p_agency_id uuid)
RETURNS TABLE(
  can_score boolean,
  subscription_remaining integer,
  purchased_remaining integer,
  total_remaining integer,
  message text
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
      999999::integer,
      'Unlimited call scoring'::text;
    RETURN;
  END IF;

  INSERT INTO public.agency_call_balance (agency_id, subscription_calls_limit)
  VALUES (p_agency_id, CASE WHEN v_status = 'active' THEN 20 WHEN v_status = 'trialing' THEN 3 ELSE 0 END)
  ON CONFLICT (agency_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM public.agency_call_balance
  WHERE agency_id = p_agency_id;

  DECLARE
    v_sub_remaining integer;
    v_total integer;
  BEGIN
    v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));
    v_total := v_sub_remaining + COALESCE(v_balance.purchased_calls_remaining, 0);

    RETURN QUERY SELECT
      (v_total > 0),
      v_sub_remaining,
      COALESCE(v_balance.purchased_calls_remaining, 0),
      v_total,
      CASE
        WHEN v_total > 0 THEN format('%s calls remaining', v_total)
        WHEN v_status = 'trialing' THEN 'Trial call scores used. Upgrade to continue.'
        ELSE 'No calls remaining. Purchase a call pack to continue.'
      END;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_call_score(p_agency_id uuid)
RETURNS TABLE(
  success boolean,
  remaining integer,
  source text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance record;
  v_status text;
  v_sub_remaining integer;
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

  IF v_status = '1on1_client' THEN
    UPDATE public.agency_call_balance
    SET total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT TRUE, 999999::integer, 'unlimited'::text, 'Call scored'::text;
    RETURN;
  END IF;

  SELECT * INTO v_balance
  FROM public.agency_call_balance
  WHERE agency_id = p_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::integer, 'none'::text, 'No call balance found'::text;
    RETURN;
  END IF;

  v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));

  IF v_sub_remaining > 0 THEN
    UPDATE public.agency_call_balance
    SET subscription_calls_used = subscription_calls_used + 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT
      TRUE,
      (v_sub_remaining - 1 + COALESCE(v_balance.purchased_calls_remaining, 0))::integer,
      'subscription'::text,
      'Call scored from monthly allowance'::text;
    RETURN;
  END IF;

  IF COALESCE(v_balance.purchased_calls_remaining, 0) > 0 THEN
    UPDATE public.agency_call_balance
    SET purchased_calls_remaining = purchased_calls_remaining - 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT
      TRUE,
      (v_balance.purchased_calls_remaining - 1)::integer,
      'purchased'::text,
      'Call scored from purchased pack'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    FALSE,
    0::integer,
    'none'::text,
    CASE
      WHEN v_status = 'trialing' THEN 'Trial calls used. Upgrade to continue scoring calls.'
      ELSE 'No calls remaining. Purchase a call pack.'
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_purchased_calls(
  p_agency_id uuid,
  p_call_count integer,
  p_purchase_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.agency_call_balance (agency_id)
  VALUES (p_agency_id)
  ON CONFLICT (agency_id) DO NOTHING;

  UPDATE public.agency_call_balance
  SET purchased_calls_remaining = COALESCE(purchased_calls_remaining, 0) + p_call_count,
      updated_at = now()
  WHERE agency_id = p_agency_id
  RETURNING purchased_calls_remaining INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_subscription_calls(
  p_agency_id uuid,
  p_new_limit integer,
  p_period_start date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.agency_call_balance (agency_id, subscription_calls_used, subscription_calls_limit, subscription_period_start)
  VALUES (p_agency_id, 0, p_new_limit, p_period_start)
  ON CONFLICT (agency_id) DO UPDATE SET
    subscription_calls_used = 0,
    subscription_calls_limit = p_new_limit,
    subscription_period_start = p_period_start,
    updated_at = now();
END;
$$;

-- =============================================================================
-- Execute privilege hardening
-- =============================================================================

-- Tenant-facing: authenticated users and service role
REVOKE EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_feature_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_feature_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_access(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.use_call_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_call_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_call_score(uuid) TO service_role;

-- Internal-only: service role
REVOKE EXECUTE ON FUNCTION public.sync_subscription_status(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_subscription_status(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_status(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_purchased_calls(uuid, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_purchased_calls(uuid, integer, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_purchased_calls(uuid, integer, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) TO service_role;
