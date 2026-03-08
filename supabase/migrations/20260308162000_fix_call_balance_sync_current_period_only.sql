-- FIX: Previous sync (20260308161000) counted calls since subscription_period_start
-- (original activation date), but credits reset monthly. Must only count calls in
-- the CURRENT billing period.
--
-- Also restores bonus_calls_remaining that was incorrectly decremented:
--   Agency 48cf6af1: had 10 bonus, was zeroed
--   Agency 77d98c24: had 100 bonus, was zeroed

-- Step 1: Restore bonus credits that were incorrectly decremented
UPDATE agency_call_balance SET bonus_calls_remaining = 10
WHERE agency_id = '48cf6af1-fe22-4cfc-85d7-caceea87e68a' AND bonus_calls_remaining = 0;

UPDATE agency_call_balance SET bonus_calls_remaining = 100
WHERE agency_id = '77d98c24-611e-42ff-bf32-a50de536ab1b' AND bonus_calls_remaining = 0;

-- Step 2: Recalculate subscription_calls_used and addon_calls_remaining
-- based on current billing period only
DO $$
DECLARE
  r record;
  v_reset_day integer;
  v_current_period_start date;
  v_calls_this_period integer;
  v_remaining integer;
  v_sub_to_use integer;
  v_addon_to_use integer;
  v_bonus_to_use integer;
BEGIN
  FOR r IN
    SELECT
      b.agency_id,
      b.subscription_calls_limit,
      b.subscription_period_start,
      b.addon_calls_limit,
      b.bonus_calls_remaining
    FROM agency_call_balance b
    JOIN agencies a ON a.id = b.agency_id
    WHERE a.subscription_status IN ('active', 'trialing')
  LOOP
    -- Determine reset day (default 1st, cap at 28)
    v_reset_day := LEAST(COALESCE(EXTRACT(DAY FROM r.subscription_period_start)::integer, 1), 28);

    -- Find start of current billing period
    IF EXTRACT(DAY FROM CURRENT_DATE)::integer >= v_reset_day THEN
      v_current_period_start := date_trunc('month', CURRENT_DATE)::date + (v_reset_day - 1);
    ELSE
      v_current_period_start := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date + (v_reset_day - 1);
    END IF;

    -- Count calls in CURRENT billing period only
    SELECT COUNT(*) INTO v_calls_this_period
    FROM agency_calls
    WHERE agency_id = r.agency_id
      AND created_at >= v_current_period_start::timestamptz;

    v_remaining := v_calls_this_period;

    -- Priority 1: Subscription
    v_sub_to_use := LEAST(v_remaining, COALESCE(r.subscription_calls_limit, 0));
    v_remaining := v_remaining - v_sub_to_use;

    -- Priority 2: Addon
    v_addon_to_use := LEAST(v_remaining, COALESCE(r.addon_calls_limit, 0));
    v_remaining := v_remaining - v_addon_to_use;

    -- Priority 3: Bonus (only if calls spill past sub + addon)
    v_bonus_to_use := LEAST(v_remaining, COALESCE(r.bonus_calls_remaining, 0));

    -- Apply
    UPDATE agency_call_balance
    SET
      subscription_calls_used = v_sub_to_use,
      addon_calls_remaining = GREATEST(0, COALESCE(addon_calls_limit, 0) - v_addon_to_use),
      bonus_calls_remaining = GREATEST(0, COALESCE(bonus_calls_remaining, 0) - v_bonus_to_use),
      updated_at = now()
    WHERE agency_id = r.agency_id;

    RAISE NOTICE 'Agency %: period=% calls=% sub_used=% addon_used=% bonus_used=%',
      r.agency_id, v_current_period_start, v_calls_this_period, v_sub_to_use, v_addon_to_use, v_bonus_to_use;
  END LOOP;
END;
$$;
