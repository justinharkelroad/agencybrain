-- Add monthly call scoring addon subscriptions
-- Tables: call_scoring_addons (plan catalog), agency_call_addon_subscriptions (active addons)
-- Columns: addon_calls_remaining, addon_calls_limit, addon_period_start on agency_call_balance
-- RPCs: updated check_call_scoring_access (addon_remaining), updated use_call_score (addon priority),
--        new reset_addon_calls, new cancel_addon_calls

-- =============================================================================
-- 1. call_scoring_addons (plan definitions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.call_scoring_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  calls_per_month INT NOT NULL,
  price_cents INT NOT NULL,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_scoring_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active addons"
  ON public.call_scoring_addons FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage addons"
  ON public.call_scoring_addons FOR ALL
  USING (auth.role() = 'service_role');

-- Seed 3 tiers (stripe_price_id to be filled after Stripe product creation)
INSERT INTO public.call_scoring_addons (name, description, calls_per_month, price_cents, stripe_price_id, sort_order) VALUES
  ('30 Calls/Month', 'Add 30 call scores per month to your plan', 30, 18000, NULL, 1),
  ('50 Calls/Month', 'Add 50 call scores per month to your plan', 50, 24000, NULL, 2),
  ('100 Calls/Month', 'Add 100 call scores per month to your plan', 100, 29900, NULL, 3);

-- =============================================================================
-- 2. agency_call_addon_subscriptions (one active addon per agency)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agency_call_addon_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  call_scoring_addon_id UUID NOT NULL REFERENCES public.call_scoring_addons(id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  calls_per_month INT NOT NULL,
  price_cents INT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_addon_per_agency UNIQUE (agency_id)
);

CREATE INDEX idx_addon_subs_agency ON public.agency_call_addon_subscriptions(agency_id);
CREATE INDEX idx_addon_subs_stripe ON public.agency_call_addon_subscriptions(stripe_subscription_id);

ALTER TABLE public.agency_call_addon_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can view their addon subscription"
  ON public.agency_call_addon_subscriptions FOR SELECT
  USING (public.has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Service role can manage addon subscriptions"
  ON public.agency_call_addon_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 3. Add addon columns to agency_call_balance
-- =============================================================================

ALTER TABLE public.agency_call_balance
  ADD COLUMN IF NOT EXISTS addon_calls_remaining INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_calls_limit INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_period_start DATE;

COMMENT ON COLUMN public.agency_call_balance.addon_calls_remaining IS 'Remaining calls from monthly addon subscription';
COMMENT ON COLUMN public.agency_call_balance.addon_calls_limit IS 'Total addon calls per period (mirrors calls_per_month)';
COMMENT ON COLUMN public.agency_call_balance.addon_period_start IS 'Start of current addon billing period';

-- =============================================================================
-- 4. Updated check_call_scoring_access — add addon_remaining
-- Must DROP first because return type changed (added addon_remaining column)
-- =============================================================================

DROP FUNCTION IF EXISTS public.check_call_scoring_access(uuid);

CREATE FUNCTION public.check_call_scoring_access(p_agency_id uuid)
RETURNS TABLE(
  can_score boolean,
  subscription_remaining integer,
  addon_remaining integer,
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
      END;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_call_scoring_access(uuid) TO service_role;

-- =============================================================================
-- 5. Updated use_call_score — consumption priority:
--    subscription -> addon -> bonus -> purchased
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
  v_addon integer;
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

    v_addon := COALESCE(v_balance.addon_calls_remaining, 0);
    v_bonus := CASE
      WHEN v_balance.bonus_calls_expires_at IS NOT NULL AND v_balance.bonus_calls_expires_at > now()
      THEN COALESCE(v_balance.bonus_calls_remaining, 0)
      ELSE 0
    END;

    RETURN QUERY SELECT
      TRUE,
      (v_sub_remaining - 1 + v_addon + v_bonus + COALESCE(v_balance.purchased_calls_remaining, 0))::integer,
      'subscription'::text,
      'Call scored from monthly allowance'::text;
    RETURN;
  END IF;

  -- Priority 2: Addon calls
  v_addon := COALESCE(v_balance.addon_calls_remaining, 0);

  IF v_addon > 0 THEN
    UPDATE public.agency_call_balance
    SET addon_calls_remaining = addon_calls_remaining - 1,
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
      (v_addon - 1 + v_bonus + COALESCE(v_balance.purchased_calls_remaining, 0))::integer,
      'addon'::text,
      'Call scored from monthly add-on'::text;
    RETURN;
  END IF;

  -- Priority 3: Bonus calls (non-expired)
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

  -- Priority 4: Purchased calls
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
-- 6. New reset_addon_calls — service_role only, resets addon balance on renewal
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_addon_calls(
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

  UPDATE public.agency_call_balance
  SET addon_calls_remaining = p_new_limit,
      addon_calls_limit = p_new_limit,
      addon_period_start = p_period_start,
      updated_at = now()
  WHERE agency_id = p_agency_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_addon_calls(uuid, integer, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_addon_calls(uuid, integer, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_addon_calls(uuid, integer, date) TO service_role;

-- =============================================================================
-- 7. New cancel_addon_calls — service_role only, zeros addon balance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_addon_calls(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  UPDATE public.agency_call_balance
  SET addon_calls_remaining = 0,
      addon_calls_limit = 0,
      addon_period_start = NULL,
      updated_at = now()
  WHERE agency_id = p_agency_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_addon_calls(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_addon_calls(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_addon_calls(uuid) TO service_role;

-- =============================================================================
-- 8. Updated reset_subscription_calls — also clear expired bonus during reset
--    (preserve existing logic from bonus migration)
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

-- =============================================================================
-- 9. Reload PostgREST schema cache for return type change
-- =============================================================================

NOTIFY pgrst, 'reload schema';
