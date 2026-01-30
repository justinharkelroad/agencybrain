-- Migration: Add contact_id to onboarding sequences
-- Date: 2026-01-30
-- Description: Enables sequences to be assigned directly to contacts (not just sales).
--              This future-proofs for lead nurturing, requote follow-ups, and
--              any contact regardless of sale status.
--
-- Changes:
--   - Add contact_id to onboarding_instances (new primary link for contact-based sequences)
--   - Add contact_id to onboarding_tasks (for efficient queries)
--   - Add constraint requiring either contact_id OR sale_id
--   - Update initialize_onboarding_tasks trigger to copy contact_id to tasks

-- ============================================
-- STEP 1: Add contact_id to onboarding_instances
-- ============================================
ALTER TABLE onboarding_instances
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES agency_contacts(id) ON DELETE SET NULL;

-- Index for contact lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_contact_id
  ON onboarding_instances(contact_id) WHERE contact_id IS NOT NULL;

-- Constraint: require either contact_id OR sale_id (at least one must be set)
-- Drop existing constraint if it exists (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_instances_contact_or_sale_check'
  ) THEN
    ALTER TABLE onboarding_instances DROP CONSTRAINT onboarding_instances_contact_or_sale_check;
  END IF;
END $$;

ALTER TABLE onboarding_instances
  ADD CONSTRAINT onboarding_instances_contact_or_sale_check
  CHECK (contact_id IS NOT NULL OR sale_id IS NOT NULL);

-- ============================================
-- STEP 2: Add contact_id to onboarding_tasks
-- ============================================
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES agency_contacts(id) ON DELETE SET NULL;

-- Index for task queries by contact
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_contact_id
  ON onboarding_tasks(contact_id) WHERE contact_id IS NOT NULL;

-- ============================================
-- STEP 3: Update initialize_onboarding_tasks trigger
-- to copy contact_id from instance to tasks
-- ============================================
CREATE OR REPLACE FUNCTION initialize_onboarding_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step RECORD;
BEGIN
  -- Only run on INSERT
  IF TG_OP = 'INSERT' THEN
    -- Create a task for each step in the sequence
    FOR v_step IN
      SELECT * FROM onboarding_sequence_steps
      WHERE sequence_id = NEW.sequence_id
      ORDER BY sort_order
    LOOP
      INSERT INTO onboarding_tasks (
        instance_id,
        step_id,
        agency_id,
        contact_id,
        assigned_to_user_id,
        assigned_to_staff_user_id,
        day_number,
        action_type,
        title,
        description,
        script_template,
        due_date,
        status
      ) VALUES (
        NEW.id,
        v_step.id,
        NEW.agency_id,
        NEW.contact_id,
        NEW.assigned_to_user_id,
        NEW.assigned_to_staff_user_id,
        v_step.day_number,
        v_step.action_type,
        v_step.title,
        v_step.description,
        v_step.script_template,
        calculate_business_day_due_date(NEW.start_date, v_step.day_number),
        CASE
          WHEN calculate_business_day_due_date(NEW.start_date, v_step.day_number) < CURRENT_DATE THEN 'overdue'::onboarding_task_status
          WHEN calculate_business_day_due_date(NEW.start_date, v_step.day_number) = CURRENT_DATE THEN 'due'::onboarding_task_status
          ELSE 'pending'::onboarding_task_status
        END
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 4: Update sync_new_sequence_steps trigger
-- to include contact_id when adding tasks to active instances
-- ============================================
CREATE OR REPLACE FUNCTION sync_new_sequence_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
BEGIN
  -- Only run on INSERT of new steps
  IF TG_OP = 'INSERT' THEN
    -- Add task to all active instances of this sequence
    FOR v_instance IN
      SELECT * FROM onboarding_instances
      WHERE sequence_id = NEW.sequence_id
      AND status = 'active'
    LOOP
      -- Only add if the due date hasn't passed yet
      IF calculate_business_day_due_date(v_instance.start_date, NEW.day_number) >= CURRENT_DATE THEN
        INSERT INTO onboarding_tasks (
          instance_id,
          step_id,
          agency_id,
          contact_id,
          assigned_to_user_id,
          assigned_to_staff_user_id,
          day_number,
          action_type,
          title,
          description,
          script_template,
          due_date,
          status
        ) VALUES (
          v_instance.id,
          NEW.id,
          v_instance.agency_id,
          v_instance.contact_id,
          v_instance.assigned_to_user_id,
          v_instance.assigned_to_staff_user_id,
          NEW.day_number,
          NEW.action_type,
          NEW.title,
          NEW.description,
          NEW.script_template,
          calculate_business_day_due_date(v_instance.start_date, NEW.day_number),
          CASE
            WHEN calculate_business_day_due_date(v_instance.start_date, NEW.day_number) = CURRENT_DATE THEN 'due'::onboarding_task_status
            ELSE 'pending'::onboarding_task_status
          END
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN onboarding_instances.contact_id IS 'Links sequence instance to a contact. Either contact_id or sale_id must be set.';
COMMENT ON COLUMN onboarding_tasks.contact_id IS 'Denormalized from instance for efficient contact-based queries.';
