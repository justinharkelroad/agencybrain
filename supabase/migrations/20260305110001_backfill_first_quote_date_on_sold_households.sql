-- Backfill: Set first_quote_date on sold/quoted households where it was never set.
-- This was caused by link_sale_to_lqs_household() promoting directly to 'sold'
-- without setting first_quote_date, and useSalesBackgroundUpload leaving households
-- at 'lead' status. Both paths are now fixed going forward.
--
-- Logic: use sold_date if available (sale happened, so quote happened on or before),
-- otherwise use the earliest lqs_sales.sale_date for that household,
-- otherwise fall back to the household's created_at date.

DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH earliest_sale AS (
    SELECT household_id, MIN(sale_date) AS min_sale_date
    FROM lqs_sales
    GROUP BY household_id
  )
  UPDATE lqs_households h
  SET first_quote_date = COALESCE(
    h.sold_date,
    es.min_sale_date,
    h.created_at::date
  )
  FROM earliest_sale es
  WHERE h.id = es.household_id
    AND h.status IN ('quoted', 'sold')
    AND h.first_quote_date IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled first_quote_date on % sold/quoted households', v_updated;

  -- Also handle households with no lqs_sales (edge case: status changed manually)
  UPDATE lqs_households
  SET first_quote_date = COALESCE(sold_date, created_at::date)
  WHERE status IN ('quoted', 'sold')
    AND first_quote_date IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled first_quote_date on % additional households without sales', v_updated;
END $$;
