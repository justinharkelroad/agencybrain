-- Add bonus call credits support for admin manual grants
-- Adds bonus columns to agency_call_balance, audit table, and admin grant RPC
-- Modifies check_call_scoring_access, use_call_score, reset_subscription_calls

-- =============================================================================
-- 1. Add bonus columns to agency_call_balance
-- =============================================================================

ALTER TABLE public.agency_call_balance
  ADD COLUMN IF NOT EXISTS bonus_calls_remaining INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_calls_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.agency_call_balance.bonus_calls_remaining IS 'Bonus calls granted by admin (expire at bonus_calls_expires_at)';
COMMENT ON COLUMN public.agency_call_balance.bonus_calls_expires_at IS 'When bonus calls expire (null = no bonus)';

-- =============================================================================
-- 2. Audit table for admin call credit grants
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_call_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  call_count INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  balance_before INT NOT NULL DEFAULT 0,
  balance_after INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_admin_call_credit_grants_agency ON public.admin_call_credit_grants(agency_id);
CREATE INDEX idx_admin_call_credit_grants_granted_at ON public.admin_call_credit_grants(granted_at DESC);

ALTER TABLE public.admin_call_credit_grants ENABLE ROW LEVEL SECURITY;

-- Admins can see all grants
CREATE POLICY "Admins can view all grants"
  ON public.admin_call_credit_grants FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Agency users can see their own grants
CREATE POLICY "Agency users can view their grants"
  ON public.admin_call_credit_grants FOR SELECT
  USING (
    public.has_agency_access(auth.uid(), agency_id)
  );

-- Service role can manage
CREATE POLICY "Service role can manage grants"
  ON public.admin_call_credit_grants FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 3. admin_grant_bonus_calls RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_grant_bonus_calls(
  p_agency_id UUID,
  p_call_count INT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  bonus_remaining INT,
  expires_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_balance_before INT;
  v_balance_after INT;
  v_expires TIMESTAMPTZ;
  v_existing_expires TIMESTAMPTZ;
BEGIN
  -- Admin-only check
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'unauthorized: admin only' USING ERRCODE = '28000';
  END IF;

  IF p_call_count <= 0 THEN
    RAISE EXCEPTION 'call_count must be positive';
  END IF;

  -- Determine expiration: use provided or derive from billing period
  IF p_expires_at IS NOT NULL THEN
    v_expires := p_expires_at;
  ELSE
    -- Try to get current billing period end (end-of-day so bonus is valid through the full last day)
    SELECT (billing_period_end::timestamptz + interval '1 day' - interval '1 second') INTO v_expires
    FROM public.call_usage_tracking
    WHERE agency_id = p_agency_id
      AND billing_period_end >= CURRENT_DATE
    ORDER BY billing_period_end ASC
    LIMIT 1;

    -- Fallback: end of current month
    IF v_expires IS NULL THEN
      v_expires := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 second')::timestamptz;
    END IF;
  END IF;

  -- Ensure balance row exists
  INSERT INTO public.agency_call_balance (agency_id)
  VALUES (p_agency_id)
  ON CONFLICT (agency_id) DO NOTHING;

  -- Get current bonus balance (before)
  SELECT COALESCE(bonus_calls_remaining, 0), bonus_calls_expires_at
  INTO v_balance_before, v_existing_expires
  FROM public.agency_call_balance
  WHERE agency_id = p_agency_id
  FOR UPDATE;

  -- Zero out expired bonus before adding
  IF v_existing_expires IS NOT NULL AND v_existing_expires <= now() THEN
    v_balance_before := 0;
  END IF;

  v_balance_after := v_balance_before + p_call_count;

  -- ADDITIVE update: add to existing, extend expiration to latest
  UPDATE public.agency_call_balance
  SET bonus_calls_remaining = v_balance_after,
      bonus_calls_expires_at = GREATEST(COALESCE(
        CASE WHEN bonus_calls_expires_at <= now() THEN NULL ELSE bonus_calls_expires_at END,
        v_expires
      ), v_expires),
      updated_at = now()
  WHERE agency_id = p_agency_id;

  -- Insert audit record
  INSERT INTO public.admin_call_credit_grants (
    agency_id, call_count, expires_at, granted_by, notes,
    balance_before, balance_after
  )
  VALUES (
    p_agency_id, p_call_count, v_expires, auth.uid(), p_notes,
    v_balance_before, v_balance_after
  );

  RETURN QUERY SELECT
    TRUE,
    v_balance_after,
    v_expires,
    format('Granted %s bonus calls (total: %s, expires: %s)', p_call_count, v_balance_after, v_expires::date)::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_bonus_calls(UUID, INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_bonus_calls(UUID, INT, TIMESTAMPTZ, TEXT) TO authenticated;

-- =============================================================================
-- 4. Modified check_call_scoring_access — add bonus_remaining
-- Must DROP first because return type changed (added bonus_remaining column);
-- CREATE OR REPLACE cannot change return types.
-- =============================================================================

DROP FUNCTION IF EXISTS public.check_call_scoring_access(uuid);

CREATE FUNCTION public.check_call_scoring_access(p_agency_id uuid)
RETURNS TABLE(
  can_score boolean,
  subscription_remaining integer,
  purchased_remaining integer,
  bonus_remaining integer,
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
      0::integer,
      999999::integer,
      'Unlimited call scoring'::text;
    RETURN;
  END IF;

  INSERT INTO public.agency_call_balance (agency_id, subscription_calls_limit)
  VALUES (p_agency_id, CASE WHEN v_status = 'active' THEN 20 WHEN v_status = 'trialing' THEN 3 ELSE 0 END)
  ON CONFLICT (agency_id) DO NOTHING;

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
    v_bonus integer;
    v_total integer;
  BEGIN
    v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));
    v_bonus := COALESCE(v_balance.bonus_calls_remaining, 0);
    v_total := v_sub_remaining + v_bonus + COALESCE(v_balance.purchased_calls_remaining, 0);

    RETURN QUERY SELECT
      (v_total > 0),
      v_sub_remaining,
      COALESCE(v_balance.purchased_calls_remaining, 0),
      v_bonus,
      v_total,
      CASE
        WHEN v_total > 0 THEN format('%s calls remaining', v_total)
        WHEN v_status = 'trialing' THEN 'Trial call scores used. Upgrade to continue.'
        ELSE 'No calls remaining. Purchase a call pack to continue.'
      END;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO service_role;

-- =============================================================================
-- 5. Modified use_call_score — consume subscription -> bonus -> purchased
-- =============================================================================

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
  v_bonus integer;
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

  -- Priority 1: Subscription calls
  IF v_sub_remaining > 0 THEN
    UPDATE public.agency_call_balance
    SET subscription_calls_used = subscription_calls_used + 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    v_bonus := CASE
      WHEN v_balance.bonus_calls_expires_at IS NOT NULL AND v_balance.bonus_calls_expires_at > now()
      THEN COALESCE(v_balance.bonus_calls_remaining, 0)
      ELSE 0
    END;

    RETURN QUERY SELECT
      TRUE,
      (v_sub_remaining - 1 + v_bonus + COALESCE(v_balance.purchased_calls_remaining, 0))::integer,
      'subscription'::text,
      'Call scored from monthly allowance'::text;
    RETURN;
  END IF;

  -- Priority 2: Bonus calls (non-expired)
  v_bonus := CASE
    WHEN v_balance.bonus_calls_expires_at IS NOT NULL AND v_balance.bonus_calls_expires_at > now()
    THEN COALESCE(v_balance.bonus_calls_remaining, 0)
    ELSE 0
  END;

  IF v_bonus > 0 THEN
    UPDATE public.agency_call_balance
    SET bonus_calls_remaining = bonus_calls_remaining - 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = now()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT
      TRUE,
      (v_bonus - 1 + COALESCE(v_balance.purchased_calls_remaining, 0))::integer,
      'bonus'::text,
      'Call scored from bonus credits'::text;
    RETURN;
  END IF;

  -- Priority 3: Purchased calls
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

REVOKE EXECUTE ON FUNCTION public.use_call_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_call_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_call_score(uuid) TO service_role;

-- =============================================================================
-- 6. Modified reset_subscription_calls — clear expired bonus during reset
-- =============================================================================

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
    -- Clear expired bonus calls during period reset
    bonus_calls_remaining = CASE
      WHEN agency_call_balance.bonus_calls_expires_at IS NOT NULL AND agency_call_balance.bonus_calls_expires_at <= now()
      THEN 0
      ELSE COALESCE(agency_call_balance.bonus_calls_remaining, 0)
    END,
    bonus_calls_expires_at = CASE
      WHEN agency_call_balance.bonus_calls_expires_at IS NOT NULL AND agency_call_balance.bonus_calls_expires_at <= now()
      THEN NULL
      ELSE agency_call_balance.bonus_calls_expires_at
    END,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_subscription_calls(uuid, integer, date) TO service_role;
