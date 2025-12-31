CREATE OR REPLACE FUNCTION upsert_renewal_record(
  p_agency_id UUID,
  p_upload_id UUID,
  p_policy_number TEXT,
  p_renewal_effective_date TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_phone_alt TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_agent_number TEXT DEFAULT NULL,
  p_renewal_status TEXT DEFAULT NULL,
  p_account_type TEXT DEFAULT NULL,
  p_premium_old DECIMAL DEFAULT NULL,
  p_premium_new DECIMAL DEFAULT NULL,
  p_premium_change_dollars DECIMAL DEFAULT NULL,
  p_premium_change_percent DECIMAL DEFAULT NULL,
  p_amount_due DECIMAL DEFAULT NULL,
  p_easy_pay BOOLEAN DEFAULT FALSE,
  p_multi_line_indicator BOOLEAN DEFAULT FALSE,
  p_item_count INTEGER DEFAULT NULL,
  p_years_prior_insurance INTEGER DEFAULT NULL,
  p_household_key TEXT DEFAULT NULL,
  p_uploaded_by UUID DEFAULT NULL,
  p_uploaded_by_display_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_result JSON;
BEGIN
  -- Check for existing record (same policy + effective date)
  SELECT id INTO v_existing_id
  FROM renewal_records
  WHERE agency_id = p_agency_id
    AND policy_number = p_policy_number
    AND renewal_effective_date = p_renewal_effective_date
    AND is_active = true;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing record but preserve workflow fields (status, notes, assignment)
    UPDATE renewal_records SET
      first_name = COALESCE(p_first_name, first_name),
      last_name = COALESCE(p_last_name, last_name),
      email = COALESCE(p_email, email),
      phone = COALESCE(p_phone, phone),
      phone_alt = COALESCE(p_phone_alt, phone_alt),
      product_name = COALESCE(p_product_name, product_name),
      agent_number = COALESCE(p_agent_number, agent_number),
      renewal_status = COALESCE(p_renewal_status, renewal_status),
      account_type = COALESCE(p_account_type, account_type),
      premium_old = COALESCE(p_premium_old, premium_old),
      premium_new = COALESCE(p_premium_new, premium_new),
      premium_change_dollars = COALESCE(p_premium_change_dollars, premium_change_dollars),
      premium_change_percent = COALESCE(p_premium_change_percent, premium_change_percent),
      amount_due = COALESCE(p_amount_due, amount_due),
      easy_pay = COALESCE(p_easy_pay, easy_pay),
      multi_line_indicator = COALESCE(p_multi_line_indicator, multi_line_indicator),
      item_count = COALESCE(p_item_count, item_count),
      years_prior_insurance = COALESCE(p_years_prior_insurance, years_prior_insurance),
      household_key = COALESCE(p_household_key, household_key),
      last_upload_id = p_upload_id,
      updated_at = NOW()
    WHERE id = v_existing_id;

    v_result := json_build_object('id', v_existing_id, 'action', 'updated');
  ELSE
    -- Insert new record
    INSERT INTO renewal_records (
      agency_id, upload_id, last_upload_id, policy_number, renewal_effective_date,
      first_name, last_name, email, phone, phone_alt,
      product_name, agent_number, renewal_status, account_type,
      premium_old, premium_new, premium_change_dollars, premium_change_percent, amount_due,
      easy_pay, multi_line_indicator, item_count, years_prior_insurance,
      household_key, uploaded_by, uploaded_by_display_name,
      current_status, is_active
    ) VALUES (
      p_agency_id, p_upload_id, p_upload_id, p_policy_number, p_renewal_effective_date,
      p_first_name, p_last_name, p_email, p_phone, p_phone_alt,
      p_product_name, p_agent_number, p_renewal_status, p_account_type,
      p_premium_old, p_premium_new, p_premium_change_dollars, p_premium_change_percent, p_amount_due,
      p_easy_pay, p_multi_line_indicator, p_item_count, p_years_prior_insurance,
      p_household_key, p_uploaded_by, p_uploaded_by_display_name,
      'uncontacted', true
    )
    RETURNING id INTO v_existing_id;

    v_result := json_build_object('id', v_existing_id, 'action', 'inserted');
  END IF;

  RETURN v_result;
END;
$$;