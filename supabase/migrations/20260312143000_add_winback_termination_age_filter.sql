ALTER TABLE winback_households
ADD COLUMN IF NOT EXISTS latest_non_rewrite_termination_date DATE;

COMMENT ON COLUMN winback_households.latest_non_rewrite_termination_date IS
'Latest non-rewrite termination effective date across actionable winback policies in the household';

CREATE INDEX IF NOT EXISTS winback_households_latest_non_rewrite_termination_date_idx
  ON winback_households (agency_id, latest_non_rewrite_termination_date)
  WHERE latest_non_rewrite_termination_date IS NOT NULL;

CREATE OR REPLACE FUNCTION recalculate_winback_household_aggregates(p_household_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE winback_households h
  SET
    earliest_winback_date = (
      SELECT MIN(calculated_winback_date)
      FROM winback_policies p
      WHERE p.household_id = h.id
        AND NOT p.is_cancel_rewrite
    ),
    latest_non_rewrite_termination_date = (
      SELECT MAX(termination_effective_date)
      FROM winback_policies p
      WHERE p.household_id = h.id
        AND NOT p.is_cancel_rewrite
    ),
    total_premium_potential_cents = (
      SELECT COALESCE(SUM(premium_new_cents), 0)
      FROM winback_policies p
      WHERE p.household_id = h.id
    ),
    policy_count = (
      SELECT COUNT(*)
      FROM winback_policies p
      WHERE p.household_id = h.id
    ),
    updated_at = now()
  WHERE h.id = p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE winback_households h
SET latest_non_rewrite_termination_date = (
  SELECT MAX(p.termination_effective_date)
  FROM winback_policies p
  WHERE p.household_id = h.id
    AND NOT p.is_cancel_rewrite
);
