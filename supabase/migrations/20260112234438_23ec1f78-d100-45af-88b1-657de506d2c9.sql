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
  p_last_upload_id UUID
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
  v_new_status TEXT;
  v_result_id UUID;
  v_was_created BOOLEAN;
BEGIN
  -- Check if record exists
  SELECT car.id, car.status 
  INTO v_existing_id, v_existing_status
  FROM cancel_audit_records car
  WHERE car.agency_id = p_agency_id 
    AND car.policy_number = p_policy_number;

  IF v_existing_id IS NOT NULL THEN
    -- Record exists - UPDATE
    -- Only reset status to 'new' if currently 'resolved' or 'lost'
    v_new_status := CASE 
      WHEN v_existing_status IN ('resolved', 'lost') THEN 'new'
      ELSE v_existing_status
    END;

    -- NEW: If resetting FROM resolved, delete the payment_made activity
    -- This prevents old "wins" from inflating stats when customer reappears
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
      cancel_date = COALESCE(p_cancel_date, cancel_audit_records.cancel_date),
      renewal_effective_date = COALESCE(p_renewal_effective_date, cancel_audit_records.renewal_effective_date),
      pending_cancel_date = COALESCE(p_pending_cancel_date, cancel_audit_records.pending_cancel_date),
      status = v_new_status,
      is_active = true,
      last_upload_id = p_last_upload_id,
      updated_at = now()
    WHERE cancel_audit_records.id = v_existing_id
    RETURNING cancel_audit_records.id INTO v_result_id;

    v_was_created := false;
  ELSE
    -- Record doesn't exist - INSERT
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
      cancel_date,
      renewal_effective_date,
      pending_cancel_date,
      status,
      is_active,
      last_upload_id
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
      p_cancel_date,
      p_renewal_effective_date,
      p_pending_cancel_date,
      'new',
      true,
      p_last_upload_id
    )
    RETURNING cancel_audit_records.id INTO v_result_id;

    v_was_created := true;
  END IF;

  RETURN QUERY SELECT v_result_id, v_was_created;
END;
$$;