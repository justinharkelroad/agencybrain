-- ============================================================================
-- Sync Cancel Audit Status to LQS Households
--
-- LOGIC: If a contact has a cancel_audit_record, they MUST be a customer
-- (they have a policy that could be cancelled). Therefore, any LQS household
-- for that contact should have status = 'sold'.
--
-- When cancel_status = 'Saved', the customer was saved (still a customer).
-- When cancel_status is active, they're at risk but still have/had a policy.
-- Either way, from an LQS perspective, they achieved 'sold' status.
-- ============================================================================

-- Step 1: Trigger to sync cancel audit records to LQS
-- When a cancel audit record is created, ensure the contact's LQS is 'sold'
CREATE OR REPLACE FUNCTION sync_cancel_audit_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  v_contact_id := NEW.contact_id;

  -- If contact_id is set, update their LQS households to 'sold'
  -- (having a cancel audit means they ARE a customer)
  IF v_contact_id IS NOT NULL THEN
    UPDATE lqs_households
    SET
      status = 'sold',
      sold_date = COALESCE(sold_date, CURRENT_DATE),
      needs_attention = false,
      updated_at = now()
    WHERE agency_id = NEW.agency_id
      AND contact_id = v_contact_id
      AND status != 'sold';

    IF FOUND THEN
      RAISE LOG 'sync_cancel_audit_to_lqs: Cancel audit % - updated LQS households for contact % to sold',
        NEW.id, v_contact_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_cancel_audit_to_lqs_trigger ON cancel_audit_records;

CREATE TRIGGER sync_cancel_audit_to_lqs_trigger
  AFTER INSERT ON cancel_audit_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_cancel_audit_to_lqs();


-- Step 2: One-time fix for contacts with cancel audit records but stale LQS status
DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Find contacts with cancel audit records and update their LQS households
  WITH cancel_audit_contacts AS (
    SELECT DISTINCT c.contact_id, c.agency_id
    FROM cancel_audit_records c
    WHERE c.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM cancel_audit_contacts cac
  WHERE h.contact_id = cac.contact_id
    AND h.agency_id = cac.agency_id
    AND h.status != 'sold';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % LQS households to sold status (contact had cancel audit record)', v_updated;
END $$;


-- Step 3: Also handle the case where cancel audit is resolved (Saved)
-- When a customer is "saved", they remain a customer - LQS stays 'sold'
-- This is already the correct behavior, but let's add an update trigger
-- in case cancel_status changes and we want to log it
CREATE OR REPLACE FUNCTION sync_cancel_audit_saved_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when cancel_status changes to 'Saved'
  IF TG_OP = 'UPDATE' AND
     (NEW.cancel_status = 'Saved' OR NEW.cancel_status = 'saved') AND
     (OLD.cancel_status IS NULL OR (OLD.cancel_status != 'Saved' AND OLD.cancel_status != 'saved')) THEN

    -- Log the save - LQS status should already be 'sold'
    RAISE LOG 'sync_cancel_audit_saved_to_lqs: Cancel audit % saved - contact % remains a customer',
      NEW.id, NEW.contact_id;

    -- Ensure LQS is 'sold' (belt and suspenders)
    IF NEW.contact_id IS NOT NULL THEN
      UPDATE lqs_households
      SET
        status = 'sold',
        sold_date = COALESCE(sold_date, CURRENT_DATE),
        needs_attention = false,
        updated_at = now()
      WHERE agency_id = NEW.agency_id
        AND contact_id = NEW.contact_id
        AND status != 'sold';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_cancel_audit_saved_trigger ON cancel_audit_records;

CREATE TRIGGER sync_cancel_audit_saved_trigger
  AFTER UPDATE ON cancel_audit_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_cancel_audit_saved_to_lqs();


COMMENT ON FUNCTION sync_cancel_audit_to_lqs() IS
  'Syncs new cancel audit records to LQS - if contact has cancel audit, they are a customer (sold). Added in 20260131141000.';

COMMENT ON FUNCTION sync_cancel_audit_saved_to_lqs() IS
  'Ensures LQS stays sold when cancel audit is saved. Added in 20260131141000.';
