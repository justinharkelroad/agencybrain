-- Fix: Doubled names in lqs_households
-- Bug: Source Excel files sometimes have the full name in BOTH "Customer First Name"
-- and "Customer Last Name" columns, resulting in first_name="Gwendolyn Smith",
-- last_name="Gwendolyn Smith". This causes doubled display like "GWENDOLYN SMITH GWENDOLYN SMITH".
--
-- Fix: Split the duplicated full name into proper first/last, regenerate household_key,
-- and merge into any existing household that already has the correct key.

DO $$
DECLARE
  rec RECORD;
  new_first TEXT;
  new_last TEXT;
  new_key TEXT;
  existing_id UUID;
  fixed_count INT := 0;
  merged_count INT := 0;
  skipped_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting doubled-name fix scan...';

  FOR rec IN
    SELECT id, agency_id, first_name, last_name, zip_code, household_key
    FROM lqs_households
    WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(last_name))
      AND TRIM(first_name) <> ''
  LOOP
    -- Determine how to split the name
    IF rec.first_name LIKE '%,%' THEN
      -- "Last, First" comma format
      new_last := TRIM(SPLIT_PART(rec.first_name, ',', 1));
      new_first := TRIM(SUBSTRING(rec.first_name FROM POSITION(',' IN rec.first_name) + 1));
      IF new_first = '' THEN
        new_first := new_last;
      END IF;
    ELSIF rec.first_name LIKE '% %' THEN
      -- "First Last" space format — first word = first_name, rest = last_name
      new_first := TRIM(SPLIT_PART(rec.first_name, ' ', 1));
      new_last := TRIM(SUBSTRING(rec.first_name FROM POSITION(' ' IN rec.first_name) + 1));
    ELSE
      -- Single word — nothing to split, skip
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- Generate the corrected household_key
    new_key := generate_household_key(new_first, new_last, rec.zip_code);

    -- Check if a household with the corrected key already exists for this agency
    SELECT id INTO existing_id
    FROM lqs_households
    WHERE agency_id = rec.agency_id
      AND household_key = new_key
      AND id <> rec.id;

    IF existing_id IS NOT NULL THEN
      -- Collision: a correct household already exists.
      -- Move quotes and sales from the bad household to the correct one,
      -- then delete the bad one. (Both tables have ON DELETE CASCADE,
      -- so we must move BEFORE deleting to preserve data.)
      UPDATE lqs_quotes
      SET household_id = existing_id
      WHERE household_id = rec.id;

      UPDATE lqs_sales
      SET household_id = existing_id
      WHERE household_id = rec.id;

      DELETE FROM lqs_households WHERE id = rec.id;

      merged_count := merged_count + 1;
      RAISE NOTICE 'Merged household % (%) into existing % (key=%)',
        rec.id, rec.first_name, existing_id, new_key;
    ELSE
      -- No collision: update the household in place
      UPDATE lqs_households
      SET first_name = new_first,
          last_name = new_last,
          household_key = new_key
      WHERE id = rec.id;

      fixed_count := fixed_count + 1;
      RAISE NOTICE 'Fixed household %: "%" / "%" -> "%" / "%" (key=%)',
        rec.id, rec.first_name, rec.last_name, new_first, new_last, new_key;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done. Fixed: %, Merged: %, Skipped (single word): %',
    fixed_count, merged_count, skipped_count;
END $$;
