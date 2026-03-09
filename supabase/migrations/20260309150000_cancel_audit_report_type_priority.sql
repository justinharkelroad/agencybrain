-- Fix: Cancellation report_type has higher priority than Pending Cancel.
--
-- Problem: When a policy appears on both the Cancellation and Pending Cancel
-- carrier reports, whichever upload runs LAST overwrites the report_type.
-- This forces users to upload in a specific order (PC first, then Cancellation)
-- and causes records to "drop" from the cancellation view if uploaded in reverse.
--
-- Fix: Add a priority guard in upsert_cancel_audit_record(). If the existing
-- record is an ACTIVE cancellation, a Pending Cancel upload cannot downgrade it.
-- If the cancellation record is inactive (dropped/resolved/lost), the PC upload
-- is allowed through — covering the real-world case where a customer pays up,
-- falls off the cancellation list, then later misses a payment and lands on PC.

-- Drop the current 26-param version so we can recreate cleanly
DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, BIGINT
);

-- Recreate with priority guard
CREATE OR REPLACE FUNCTION upsert_cancel_audit_record(
  p_agency_id UUID,
  p_policy_number TEXT,
  p_household_key TEXT,
  p_insured_first_name TEXT,
  p_insured_last_name TEXT,
  p_insured_email TEXT,
  p_insured_phone TEXT,
  p_insured_phone_alt TEXT,
  p_agent_number TEXT,
  p_product_name TEXT,
  p_premium_cents BIGINT,
  p_no_of_items INTEGER,
  p_account_type TEXT,
  p_report_type TEXT,
  p_amount_due_cents BIGINT,
  p_cancel_date DATE,
  p_renewal_effective_date DATE,
  p_pending_cancel_date DATE,
  p_last_upload_id UUID,
  p_original_year TEXT DEFAULT NULL,
  p_cancel_status TEXT DEFAULT NULL,
  -- Enrichment parameters
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_company_code TEXT DEFAULT NULL,
  p_premium_old_cents BIGINT DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  was_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_status TEXT;
  v_existing_contact_id UUID;
  v_existing_report_type TEXT;
  v_existing_is_active BOOLEAN;
  v_new_status TEXT;
  v_result_id UUID;
  v_was_created BOOLEAN;
  v_contact_id UUID;
BEGIN
  -- Find or create unified contact
  IF p_insured_last_name IS NOT NULL AND TRIM(p_insured_last_name) != '' THEN
    BEGIN
      v_contact_id := find_or_create_contact(
        p_agency_id,
        p_insured_first_name,
        p_insured_last_name,
        NULL,
        p_insured_phone,
        p_insured_email
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact for cancel audit record: %', SQLERRM;
      v_contact_id := NULL;
    END;
  END IF;

  SELECT car.id, car.status, car.contact_id, car.report_type, car.is_active
  INTO v_existing_id, v_existing_status, v_existing_contact_id, v_existing_report_type, v_existing_is_active
  FROM cancel_audit_records car
  WHERE car.agency_id = p_agency_id
    AND car.policy_number = p_policy_number;

  IF v_existing_id IS NOT NULL THEN
    -- PRIORITY GUARD: Active cancellation records cannot be downgraded to pending_cancel.
    -- Only active cancellation records are protected — if the record was dropped from
    -- the cancellation report (is_active = false), a PC upload can take it over.
    IF v_existing_report_type = 'cancellation'
       AND p_report_type = 'pending_cancel'
       AND v_existing_is_active = true
    THEN
      RETURN QUERY SELECT v_existing_id, false;
      RETURN;
    END IF;

    v_new_status := CASE
      WHEN v_existing_status IN ('resolved', 'lost') THEN 'new'
      ELSE v_existing_status
    END;

    IF v_existing_status = 'resolved' AND v_new_status = 'new' THEN
      DELETE FROM cancel_audit_activities
      WHERE record_id = v_existing_id
        AND activity_type = 'payment_made';
    END IF;

    UPDATE cancel_audit_records SET
      household_key = p_household_key,
      insured_first_name = p_insured_first_name,
      insured_last_name = p_insured_last_name,
      insured_email = p_insured_email,
      insured_phone = p_insured_phone,
      insured_phone_alt = COALESCE(p_insured_phone_alt, cancel_audit_records.insured_phone_alt),
      agent_number = p_agent_number,
      product_name = p_product_name,
      premium_cents = p_premium_cents,
      no_of_items = p_no_of_items,
      account_type = p_account_type,
      report_type = p_report_type,
      amount_due_cents = COALESCE(p_amount_due_cents, cancel_audit_records.amount_due_cents),
      cancel_status = COALESCE(p_cancel_status, cancel_audit_records.cancel_status),
      cancel_date = COALESCE(p_cancel_date, cancel_audit_records.cancel_date),
      renewal_effective_date = COALESCE(p_renewal_effective_date, cancel_audit_records.renewal_effective_date),
      pending_cancel_date = COALESCE(p_pending_cancel_date, cancel_audit_records.pending_cancel_date),
      original_year = COALESCE(p_original_year, cancel_audit_records.original_year),
      -- Enrichment columns with COALESCE to preserve existing values
      city = COALESCE(p_city, cancel_audit_records.city),
      state = COALESCE(p_state, cancel_audit_records.state),
      zip_code = COALESCE(p_zip_code, cancel_audit_records.zip_code),
      company_code = COALESCE(p_company_code, cancel_audit_records.company_code),
      premium_old_cents = CASE
        WHEN p_premium_old_cents > 0 THEN p_premium_old_cents
        ELSE COALESCE(cancel_audit_records.premium_old_cents, 0)
      END,
      status = v_new_status,
      is_active = true,
      dropped_from_report_at = NULL,
      last_upload_id = p_last_upload_id,
      contact_id = COALESCE(v_contact_id, v_existing_contact_id),
      updated_at = now()
    WHERE cancel_audit_records.id = v_existing_id
    RETURNING cancel_audit_records.id INTO v_result_id;

    v_was_created := false;
  ELSE
    INSERT INTO cancel_audit_records (
      agency_id,
      policy_number,
      household_key,
      insured_first_name,
      insured_last_name,
      insured_email,
      insured_phone,
      insured_phone_alt,
      agent_number,
      product_name,
      premium_cents,
      no_of_items,
      account_type,
      report_type,
      amount_due_cents,
      cancel_status,
      cancel_date,
      renewal_effective_date,
      pending_cancel_date,
      original_year,
      city,
      state,
      zip_code,
      company_code,
      premium_old_cents,
      status,
      is_active,
      last_upload_id,
      contact_id
    ) VALUES (
      p_agency_id,
      p_policy_number,
      p_household_key,
      p_insured_first_name,
      p_insured_last_name,
      p_insured_email,
      p_insured_phone,
      p_insured_phone_alt,
      p_agent_number,
      p_product_name,
      p_premium_cents,
      p_no_of_items,
      p_account_type,
      p_report_type,
      p_amount_due_cents,
      p_cancel_status,
      p_cancel_date,
      p_renewal_effective_date,
      p_pending_cancel_date,
      p_original_year,
      p_city,
      p_state,
      p_zip_code,
      p_company_code,
      p_premium_old_cents,
      'new',
      true,
      p_last_upload_id,
      v_contact_id
    )
    RETURNING cancel_audit_records.id INTO v_result_id;

    v_was_created := true;
  END IF;

  RETURN QUERY SELECT v_result_id, v_was_created;
END;
$$;

-- Explicitly tell PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
