-- Backfill agency_contacts for lqs_households that were created via sales upload
-- or sync without a contact_id. This fixes records created before the application
-- code was updated to call find_or_create_contact on all sale entry paths.

DO $$
DECLARE
  rec RECORD;
  v_contact_id uuid;
  v_count int := 0;
  v_total int;
BEGIN
  SELECT count(*) INTO v_total
  FROM lqs_households
  WHERE contact_id IS NULL
    AND last_name IS NOT NULL
    AND last_name != ''
    AND last_name != 'UNKNOWN';

  RAISE LOG 'backfill_contacts_for_sales_households: % households need contacts', v_total;

  FOR rec IN
    SELECT id, agency_id, first_name, last_name, zip_code, phone, email
    FROM lqs_households
    WHERE contact_id IS NULL
      AND last_name IS NOT NULL
      AND last_name != ''
      AND last_name != 'UNKNOWN'
    ORDER BY agency_id, created_at
  LOOP
    BEGIN
      v_contact_id := find_or_create_contact(
        p_agency_id   := rec.agency_id,
        p_first_name  := COALESCE(NULLIF(rec.first_name, ''), NULL),
        p_last_name   := rec.last_name,
        p_zip_code    := rec.zip_code,
        p_phone       := CASE
                           WHEN rec.phone IS NOT NULL AND array_length(rec.phone, 1) > 0
                           THEN rec.phone[1]
                           ELSE NULL
                         END,
        p_email       := rec.email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE lqs_households
        SET contact_id = v_contact_id
        WHERE id = rec.id
          AND contact_id IS NULL;

        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'backfill_contacts: failed for household % (agency %): %',
        rec.id, rec.agency_id, SQLERRM;
    END;
  END LOOP;

  RAISE LOG 'backfill_contacts_for_sales_households: created/linked % contacts out of % households', v_count, v_total;
END;
$$;
