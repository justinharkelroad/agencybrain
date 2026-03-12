-- RPC to recalculate all winback dates for an agency when contact_days_before changes.
-- Loops through each winback_policy, finds the next future competitor renewal,
-- then sets calculated_winback_date = renewal - contact_days_before.
-- Finally updates each household's earliest_winback_date to the MIN across its policies.

CREATE OR REPLACE FUNCTION recalculate_winback_dates(
  p_agency_id uuid,
  p_contact_days_before int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_tz text;
  v_today date;
  v_competitor_renewal date;
  v_winback_date date;
  v_count int := 0;
BEGIN
  -- Input validation
  IF p_contact_days_before < 1 OR p_contact_days_before > 90 THEN
    RAISE EXCEPTION 'contact_days_before must be between 1 and 90';
  END IF;

  -- Auth: JWT users must have agency access; service_role (edge functions) is trusted
  IF auth.uid() IS NOT NULL THEN
    IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  -- Use agency timezone for "today" — CURRENT_DATE is UTC in service_role/PostgREST
  SELECT a.timezone INTO v_tz FROM agencies a WHERE a.id = p_agency_id;
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(v_tz, 'America/New_York'))::date;

  -- Recalculate each policy's winback date
  -- winback_policies has its own agency_id column, no join needed
  FOR rec IN
    SELECT wp.id, wp.household_id, wp.termination_effective_date, wp.policy_term_months
    FROM winback_policies wp
    WHERE wp.agency_id = p_agency_id
      AND wp.termination_effective_date IS NOT NULL
      AND wp.policy_term_months IS NOT NULL
      AND wp.policy_term_months > 0
  LOOP
    v_competitor_renewal := rec.termination_effective_date
      + (rec.policy_term_months * INTERVAL '1 month');

    WHILE v_competitor_renewal <= v_today LOOP
      v_competitor_renewal := v_competitor_renewal
        + (rec.policy_term_months * INTERVAL '1 month');
    END LOOP;

    v_winback_date := v_competitor_renewal - (p_contact_days_before * INTERVAL '1 day');

    UPDATE winback_policies
    SET calculated_winback_date = v_winback_date
    WHERE id = rec.id;

    v_count := v_count + 1;
  END LOOP;

  -- Update each household's earliest_winback_date to the MIN of its policies.
  -- Filter out NULL calculated_winback_date to avoid NULLing out valid dates.
  UPDATE winback_households wh
  SET earliest_winback_date = sub.min_date
  FROM (
    SELECT wp.household_id, MIN(wp.calculated_winback_date) AS min_date
    FROM winback_policies wp
    WHERE wp.agency_id = p_agency_id
      AND wp.calculated_winback_date IS NOT NULL
    GROUP BY wp.household_id
  ) sub
  WHERE wh.id = sub.household_id
    AND wh.agency_id = p_agency_id;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION recalculate_winback_dates(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recalculate_winback_dates(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_winback_dates(uuid, int) TO service_role;
