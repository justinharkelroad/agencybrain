-- ============================================================================
-- Fix: LQS Roadmap "Open Leads" bucket showing ZERO
--
-- ROOT CAUSE: Migration 20260205220000 ("fix_stuck_and_ghost_households")
-- deleted ALL lqs_households with status='lead' that had no quotes and no sales.
-- This was intended to clean up empty ghost records from failed quote uploads,
-- but it also removed legitimate open leads.
--
-- IMPACT:
-- - Contacts page still shows "Open Lead" (via ELSE fallback in get_contacts_by_stage)
-- - LQS Roadmap shows 0 open leads (counts lqs_households.status='lead' which is empty)
--
-- FIX: Backfill lqs_households records (status='lead') for agency_contacts that:
--   1. Have no corresponding lqs_households record
--   2. Are not in winback, renewal, or cancel_audit lifecycle stages
-- These contacts are already displaying as "Open Lead" on the Contacts page;
-- this migration gives them a proper lqs_households record so the LQS Roadmap
-- can count them.
-- ============================================================================

DO $$
DECLARE
  v_inserted INT;
BEGIN
  INSERT INTO lqs_households (
    agency_id,
    household_key,
    first_name,
    last_name,
    zip_code,
    phone,
    email,
    status,
    contact_id,
    needs_attention,
    lead_received_date,
    skip_metrics_increment
  )
  SELECT
    ac.agency_id,
    ac.household_key,
    ac.first_name,
    ac.last_name,
    ac.zip_code,
    ac.phones,
    ac.emails[1],  -- Take first email (lqs_households.email is text, not text[])
    'lead',
    ac.id,
    false,
    ac.created_at::date,
    true  -- Prevent metrics trigger from firing on historical backfill
  FROM agency_contacts ac
  -- Exclude contacts that already have an lqs_household
  LEFT JOIN lqs_households lh
    ON lh.agency_id = ac.agency_id
   AND lh.household_key = ac.household_key
  -- Exclude contacts in active winback
  LEFT JOIN winback_households wh
    ON wh.agency_id = ac.agency_id
   AND wh.contact_id = ac.id
   AND wh.status IN ('untouched', 'in_progress')
  -- Exclude contacts in active renewal
  LEFT JOIN renewal_records rr
    ON rr.agency_id = ac.agency_id
   AND rr.contact_id = ac.id
   AND rr.is_active = true
  -- Exclude contacts in active cancel audit
  LEFT JOIN cancel_audit_records car
    ON car.agency_id = ac.agency_id
   AND car.contact_id = ac.id
   AND car.is_active = true
  WHERE lh.id IS NULL           -- No existing lqs_household
    AND wh.id IS NULL           -- Not in active winback
    AND rr.id IS NULL           -- Not in active renewal
    AND car.id IS NULL          -- Not in active cancel audit
  ON CONFLICT (agency_id, household_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Backfilled % lqs_households records for orphaned open-lead contacts', v_inserted;
END $$;


-- Also backfill contact_id on existing lqs_households that are missing it.
-- The get_contacts_by_stage function joins on household_key, but having contact_id
-- set ensures a tighter link.
DO $$
DECLARE
  v_linked INT;
BEGIN
  UPDATE lqs_households h
  SET contact_id = ac.id,
      updated_at = now()
  FROM agency_contacts ac
  WHERE ac.agency_id = h.agency_id
    AND ac.household_key = h.household_key
    AND h.contact_id IS NULL;

  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RAISE NOTICE 'Linked % lqs_households to their agency_contacts via contact_id', v_linked;
END $$;
