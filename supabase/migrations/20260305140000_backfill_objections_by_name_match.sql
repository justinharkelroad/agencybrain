-- Backfill objection data on quoted_household_details by matching
-- to lqs_households via team_member + agency + date + name.
-- The prior backfill (20260305100000) only matched rows with _lqs_household_id
-- in extras, which only covers dashboard-originated quotes.
-- This backfill covers ALL quoted_household_details rows.
-- Idempotent: only updates rows where objection_id IS NULL.

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE quoted_household_details qhd
  SET
    objection_id = h.objection_id,
    objection_name = obj.name
  FROM lqs_households h
  JOIN lqs_objections obj ON obj.id = h.objection_id
  WHERE qhd.team_member_id = h.team_member_id
    AND qhd.agency_id = h.agency_id
    AND qhd.work_date = h.first_quote_date
    AND lower(qhd.household_name) = lower(trim(h.first_name || ' ' || h.last_name))
    AND qhd.objection_id IS NULL
    AND h.objection_id IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled objection data for % quoted_household_details rows (name+date match)', v_updated;
END $$;
