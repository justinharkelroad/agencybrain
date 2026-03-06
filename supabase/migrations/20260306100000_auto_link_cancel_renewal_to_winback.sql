-- Auto-link cancel audit and renewal records to winback when termination upload creates matching policies.
-- Matches on policy_number + agency_id. Two-pass: (1) link contact_id, (2) demote active work items.

-- renewal_records needs the same winback tracking columns that cancel_audit_records already has
ALTER TABLE renewal_records ADD COLUMN IF NOT EXISTS winback_household_id uuid REFERENCES winback_households(id);
ALTER TABLE renewal_records ADD COLUMN IF NOT EXISTS sent_to_winback_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_renewal_records_winback_household
  ON renewal_records(winback_household_id)
  WHERE winback_household_id IS NOT NULL;

CREATE OR REPLACE FUNCTION auto_link_terminations_to_cancel_and_renewal(
  p_agency_id UUID,
  p_policy_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancel_linked INT := 0;
  v_cancel_demoted INT := 0;
  v_renewals_linked INT := 0;
  v_renewals_demoted INT := 0;
  v_contacts_linked INT := 0;
BEGIN
  -- Agency access check for authenticated callers (service_role has auth.uid() = NULL)
  IF auth.uid() IS NOT NULL THEN
    IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  -- ============================================================
  -- PASS 1a: Link cancel_audit_records → winback_households
  -- ============================================================
  -- For each cancel_audit_record that matches a winback_policy by policy_number,
  -- set winback_household_id and sent_to_winback_at on the cancel_audit_record,
  -- and copy contact_id to the winback_household if it doesn't have one.

  WITH matched AS (
    SELECT DISTINCT ON (car.id)
      car.id AS cancel_record_id,
      car.contact_id AS cancel_contact_id,
      car.household_key AS cancel_household_key,
      wp.household_id AS winback_household_id,
      wh.contact_id AS wh_contact_id
    FROM cancel_audit_records car
    JOIN winback_policies wp
      ON wp.policy_number = car.policy_number
     AND wp.agency_id = car.agency_id
    JOIN winback_households wh
      ON wh.id = wp.household_id
    WHERE car.agency_id = p_agency_id
      AND car.policy_number = ANY(p_policy_numbers)
      AND car.winback_household_id IS NULL
    ORDER BY car.id
  ),
  -- Update cancel_audit_records with winback link
  updated_car AS (
    UPDATE cancel_audit_records car
    SET winback_household_id = m.winback_household_id,
        sent_to_winback_at = NOW()
    FROM matched m
    WHERE car.id = m.cancel_record_id
    RETURNING car.id
  ),
  -- Link contact_id from cancel_audit to winback_household where missing
  contacts_from_cancel AS (
    UPDATE winback_households wh
    SET contact_id = m.cancel_contact_id
    FROM matched m
    WHERE wh.id = m.winback_household_id
      AND wh.contact_id IS NULL
      AND m.cancel_contact_id IS NOT NULL
    RETURNING wh.id
  )
  SELECT
    (SELECT COUNT(*) FROM updated_car),
    (SELECT COUNT(*) FROM contacts_from_cancel)
  INTO v_cancel_linked, v_contacts_linked;

  -- ============================================================
  -- PASS 1b: Link renewal_records → winback_households
  -- ============================================================
  WITH matched_rr AS (
    SELECT DISTINCT ON (rr.id)
      rr.id AS renewal_record_id,
      rr.contact_id AS renewal_contact_id,
      wp.household_id AS winback_household_id,
      wh.contact_id AS wh_contact_id
    FROM renewal_records rr
    JOIN winback_policies wp
      ON wp.policy_number = rr.policy_number
     AND wp.agency_id = rr.agency_id
    JOIN winback_households wh
      ON wh.id = wp.household_id
    WHERE rr.agency_id = p_agency_id
      AND rr.policy_number = ANY(p_policy_numbers)
      AND rr.winback_household_id IS NULL
    ORDER BY rr.id
  ),
  updated_rr AS (
    UPDATE renewal_records rr
    SET winback_household_id = m.winback_household_id,
        sent_to_winback_at = NOW()
    FROM matched_rr m
    WHERE rr.id = m.renewal_record_id
    RETURNING rr.id
  ),
  contacts_from_renewal AS (
    UPDATE winback_households wh
    SET contact_id = m.renewal_contact_id
    FROM matched_rr m
    WHERE wh.id = m.winback_household_id
      AND wh.contact_id IS NULL
      AND m.renewal_contact_id IS NOT NULL
    RETURNING wh.id
  )
  SELECT
    v_renewals_linked + (SELECT COUNT(*) FROM updated_rr),
    v_contacts_linked + (SELECT COUNT(*) FROM contacts_from_renewal)
  INTO v_renewals_linked, v_contacts_linked;

  -- ============================================================
  -- PASS 2a: Demote active cancel_audit_records to 'lost'
  -- ============================================================
  WITH demoted_car AS (
    UPDATE cancel_audit_records car
    SET status = 'lost'
    WHERE car.agency_id = p_agency_id
      AND car.policy_number = ANY(p_policy_numbers)
      AND car.winback_household_id IS NOT NULL
      AND car.status IN ('new', 'in_progress')
    RETURNING car.id, car.agency_id, car.household_key
  ),
  -- Log activity for demoted cancel audit records
  logged_car AS (
    INSERT INTO cancel_audit_activities (
      agency_id, record_id, household_key, activity_type, notes, user_display_name
    )
    SELECT
      d.agency_id,
      d.id,
      d.household_key,
      'note',
      'Auto-moved to Win-Back (termination upload)',
      'System'
    FROM demoted_car d
    RETURNING id
  )
  SELECT COUNT(*) FROM demoted_car INTO v_cancel_demoted;

  -- ============================================================
  -- PASS 2b: Demote active renewal_records to 'lost'
  -- ============================================================
  WITH demoted_rr AS (
    UPDATE renewal_records rr
    SET current_status = 'lost',
        auto_resolved_reason = 'terminated_moved_to_winback'
    WHERE rr.agency_id = p_agency_id
      AND rr.policy_number = ANY(p_policy_numbers)
      AND rr.winback_household_id IS NOT NULL
      AND rr.current_status IN ('new', 'in_progress')
    RETURNING rr.id, rr.agency_id, rr.household_key
  ),
  -- Log activity for demoted renewal records
  logged_rr AS (
    INSERT INTO renewal_activities (
      agency_id, renewal_record_id, activity_type, comments, created_by_display_name
    )
    SELECT
      d.agency_id,
      d.id,
      'note',
      'Auto-moved to Win-Back (termination upload)',
      'System'
    FROM demoted_rr d
    RETURNING id
  )
  SELECT COUNT(*) FROM demoted_rr INTO v_renewals_demoted;

  RETURN jsonb_build_object(
    'cancel_audit_linked', v_cancel_linked,
    'cancel_audit_demoted', v_cancel_demoted,
    'renewals_linked', v_renewals_linked,
    'renewals_demoted', v_renewals_demoted,
    'contacts_linked', v_contacts_linked
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) TO authenticated;
