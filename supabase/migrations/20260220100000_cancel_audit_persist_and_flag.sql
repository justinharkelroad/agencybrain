-- Migration: Cancel Audit — Persist & Flag dropped records
-- Date: 2026-02-20
--
-- Problem: When a new cancel audit report is uploaded, ALL existing records of that
-- report type are blanket-deactivated (is_active = false), then records in the new
-- file are upserted back to is_active = true. Records that drop off the carrier
-- report stay is_active = false and vanish from the "Needs Attention" working list —
-- even if the team was actively working them.
--
-- Fix: Add dropped_from_report_at timestamp, change working-list logic from
-- is_active-gated to status-gated. Records persist until resolved/lost.

-- ============================================================================
-- 1. Add dropped_from_report_at column
-- ============================================================================

ALTER TABLE cancel_audit_records
  ADD COLUMN IF NOT EXISTS dropped_from_report_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cancel_audit_records_dropped
  ON cancel_audit_records (agency_id)
  WHERE dropped_from_report_at IS NOT NULL;

-- ============================================================================
-- 2. Modify upsert_cancel_audit_record — clear dropped flag on reappearance
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID
);
DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID, TEXT
);
DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID, TEXT, TEXT
);

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
  p_cancel_status TEXT DEFAULT NULL
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

  SELECT car.id, car.status, car.contact_id
  INTO v_existing_id, v_existing_status, v_existing_contact_id
  FROM cancel_audit_records car
  WHERE car.agency_id = p_agency_id
    AND car.policy_number = p_policy_number;

  IF v_existing_id IS NOT NULL THEN
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
      status = v_new_status,
      is_active = true,
      dropped_from_report_at = NULL,  -- Clear dropped flag on reappearance
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

-- ============================================================================
-- 3. Modify get_contacts_by_stage — use status instead of is_active
-- ============================================================================

CREATE OR REPLACE FUNCTION get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  agency_id UUID,
  first_name TEXT,
  last_name TEXT,
  phones TEXT[],
  emails TEXT[],
  household_key TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  computed_stage TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_words TEXT[];
  normalized_phone TEXT;
BEGIN
  -- Split search into words for multi-word name matching
  IF p_search IS NOT NULL AND p_search != '' THEN
    search_words := string_to_array(LOWER(TRIM(p_search)), ' ');
    -- Also extract digits-only version for phone search
    normalized_phone := regexp_replace(p_search, '[^0-9]', '', 'g');
  END IF;

  RETURN QUERY
  WITH contact_stages AS (
    SELECT
      ac.id,
      ac.agency_id,
      ac.first_name,
      ac.last_name,
      ac.phones,
      ac.emails,
      ac.household_key,
      ac.zip_code,
      ac.created_at,
      ac.updated_at,
      CASE
        -- Priority 1: Active winback (untouched or in_progress)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'

        -- Priority 2: Cancel audit SAVED + resolved = Customer (they paid, account saved)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND car.status = 'resolved'
          AND LOWER(COALESCE(car.cancel_status, '')) = 'saved'
        ) THEN 'customer'

        -- Priority 3: Cancel audit unresolved (new or in_progress) = still in cancel process
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND car.status IN ('new', 'in_progress')
        ) THEN 'cancel_audit'

        -- Priority 4: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'

        -- Priority 5: Customer (sold LQS or successful renewal or won_back)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'sold'
        ) OR EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status = 'won_back'
        ) THEN 'customer'

        -- Priority 6: Quoted HH (LQS status = quoted)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'quoted'
        ) THEN 'quoted'

        -- Priority 7: Open Lead (LQS status = lead)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'lead'
        ) THEN 'open_lead'

        -- Default: open_lead (fallback for contacts with no linked records)
        ELSE 'open_lead'
      END AS computed_stage
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      AND (
        -- No search term provided
        p_search IS NULL
        OR p_search = ''
        -- Multi-word name search: ALL words must match somewhere in first_name OR last_name
        OR NOT EXISTS (
          SELECT 1 FROM unnest(search_words) word
          WHERE NOT (
            LOWER(ac.first_name) LIKE '%' || word || '%'
            OR LOWER(ac.last_name) LIKE '%' || word || '%'
          )
        )
        -- Phone search with normalization (strips dashes, spaces, parens)
        OR (
          normalized_phone IS NOT NULL
          AND normalized_phone != ''
          AND EXISTS (
            SELECT 1 FROM unnest(ac.phones) p
            WHERE regexp_replace(p, '[^0-9]', '', 'g') LIKE '%' || normalized_phone || '%'
          )
        )
        -- Email search (exact substring match)
        OR EXISTS (
          SELECT 1 FROM unnest(ac.emails) e
          WHERE e ILIKE '%' || p_search || '%'
        )
      )
  ),
  filtered_contacts AS (
    SELECT * FROM contact_stages
    WHERE p_stage IS NULL OR p_stage = 'all' OR computed_stage = p_stage
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_contacts
  )
  SELECT
    fc.id,
    fc.agency_id,
    fc.first_name,
    fc.last_name,
    fc.phones,
    fc.emails,
    fc.household_key,
    fc.zip_code,
    fc.created_at,
    fc.updated_at,
    fc.computed_stage,
    c.total
  FROM filtered_contacts fc
  CROSS JOIN counted c
  ORDER BY fc.last_name, fc.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 4. Backfill existing dropped-but-unresolved records
-- ============================================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  UPDATE cancel_audit_records
  SET dropped_from_report_at = updated_at
  WHERE is_active = false
    AND status IN ('new', 'in_progress');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled dropped_from_report_at for % records', v_count;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
