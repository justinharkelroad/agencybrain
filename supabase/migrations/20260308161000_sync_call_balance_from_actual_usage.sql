-- Sync agency_call_balance with actual call usage this billing period
-- The transcribe-call edge function was only decrementing the OLD system (call_usage_tracking)
-- and not the NEW system (agency_call_balance). This migration backfills the correct usage.
--
-- Logic: For each agency with a balance row, count agency_calls created since
-- subscription_period_start (or start of current month if null). Apply usage
-- in priority order: subscription → addon → bonus → purchased.

DO $$
DECLARE
  r record;
  v_calls_this_period integer;
  v_remaining integer;
  v_sub_to_use integer;
  v_addon_to_use integer;
  v_bonus_to_use integer;
  v_purchased_to_use integer;
BEGIN
  FOR r IN
    SELECT
      b.agency_id,
      b.subscription_calls_limit,
      b.subscription_period_start,
      b.addon_calls_remaining,
      b.addon_calls_limit,
      b.bonus_calls_remaining,
      b.purchased_calls_remaining
    FROM agency_call_balance b
    JOIN agencies a ON a.id = b.agency_id
    WHERE a.subscription_status IN ('active', 'trialing', '1on1_client')
  LOOP
    -- Skip unlimited (1on1) agencies
    IF (SELECT subscription_status FROM agencies WHERE id = r.agency_id) = '1on1_client' THEN
      CONTINUE;
    END IF;

    -- Count calls scored this billing period
    SELECT COUNT(*) INTO v_calls_this_period
    FROM agency_calls
    WHERE agency_id = r.agency_id
      AND created_at >= COALESCE(r.subscription_period_start, date_trunc('month', CURRENT_DATE))::timestamptz;

    -- Skip if no calls scored
    IF v_calls_this_period = 0 THEN
      CONTINUE;
    END IF;

    v_remaining := v_calls_this_period;

    -- Priority 1: Subscription calls
    v_sub_to_use := LEAST(v_remaining, COALESCE(r.subscription_calls_limit, 0));
    v_remaining := v_remaining - v_sub_to_use;

    -- Priority 2: Addon calls
    v_addon_to_use := LEAST(v_remaining, COALESCE(r.addon_calls_limit, 0));
    v_remaining := v_remaining - v_addon_to_use;

    -- Priority 3: Bonus calls
    v_bonus_to_use := LEAST(v_remaining, COALESCE(r.bonus_calls_remaining, 0));
    v_remaining := v_remaining - v_bonus_to_use;

    -- Priority 4: Purchased calls
    v_purchased_to_use := LEAST(v_remaining, COALESCE(r.purchased_calls_remaining, 0));

    -- Apply the sync
    UPDATE agency_call_balance
    SET
      subscription_calls_used = v_sub_to_use,
      addon_calls_remaining = GREATEST(0, COALESCE(addon_calls_limit, 0) - v_addon_to_use),
      bonus_calls_remaining = GREATEST(0, COALESCE(bonus_calls_remaining, 0) - v_bonus_to_use),
      purchased_calls_remaining = GREATEST(0, COALESCE(purchased_calls_remaining, 0) - v_purchased_to_use),
      updated_at = now()
    WHERE agency_id = r.agency_id;

    RAISE NOTICE 'Agency %: % calls this period → sub_used=%, addon_used=%, bonus_used=%, purchased_used=%',
      r.agency_id, v_calls_this_period, v_sub_to_use, v_addon_to_use, v_bonus_to_use, v_purchased_to_use;
  END LOOP;
END;
$$;
