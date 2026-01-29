-- Migration: Onboarding Sequences System - Phase 1 (Database Foundation)
-- Date: 2026-01-29
-- Description: Creates tables, RLS policies, functions, and triggers for the
--              onboarding sequence system. This enables agencies to create
--              customizable follow-up sequences and assign them to sales.
--
-- Tables Created:
--   - onboarding_sequences: Sequence templates
--   - onboarding_sequence_steps: Steps within templates
--   - onboarding_instances: Assigned sequences to customers/sales
--   - onboarding_tasks: Individual tasks generated from steps
--
-- Access Model:
--   - Brain Portal (JWT auth): Uses RLS with has_agency_access()
--   - Staff Portal (no auth.uid): Uses edge functions with service role

-- ============================================
-- ENUMS
-- ============================================

-- Action types for sequence steps and tasks
DO $$ BEGIN
  CREATE TYPE onboarding_action_type AS ENUM ('call', 'text', 'email', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Status for individual tasks
DO $$ BEGIN
  CREATE TYPE onboarding_task_status AS ENUM ('pending', 'due', 'overdue', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Status for sequence instances
DO $$ BEGIN
  CREATE TYPE onboarding_instance_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Target type for sequences (for future filtering/categorization)
DO $$ BEGIN
  CREATE TYPE onboarding_sequence_target_type AS ENUM ('onboarding', 'lead_nurturing', 'requote', 'retention', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLE: onboarding_sequences
-- Templates created by agency managers/owners
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_type onboarding_sequence_target_type NOT NULL DEFAULT 'onboarding',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_agency_id ON onboarding_sequences(agency_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_agency_active ON onboarding_sequences(agency_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_target_type ON onboarding_sequences(agency_id, target_type);

-- RLS
ALTER TABLE onboarding_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_sequences_select_policy ON onboarding_sequences
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_sequences_insert_policy ON onboarding_sequences
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_sequences_update_policy ON onboarding_sequences
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_sequences_delete_policy ON onboarding_sequences
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_sequences TO authenticated;

-- ============================================
-- TABLE: onboarding_sequence_steps
-- Steps within a sequence template
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES onboarding_sequences(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 0 CHECK (day_number >= 0),
  action_type onboarding_action_type NOT NULL DEFAULT 'call',
  title TEXT NOT NULL,
  description TEXT,
  script_template TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_sequence_steps_sequence_id ON onboarding_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sequence_steps_sequence_order ON onboarding_sequence_steps(sequence_id, sort_order);

-- RLS (inherit from parent sequence via join)
ALTER TABLE onboarding_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_sequence_steps_select_policy ON onboarding_sequence_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM onboarding_sequences s
      WHERE s.id = onboarding_sequence_steps.sequence_id
      AND has_agency_access(auth.uid(), s.agency_id)
    )
  );

CREATE POLICY onboarding_sequence_steps_insert_policy ON onboarding_sequence_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_sequences s
      WHERE s.id = onboarding_sequence_steps.sequence_id
      AND has_agency_access(auth.uid(), s.agency_id)
    )
  );

CREATE POLICY onboarding_sequence_steps_update_policy ON onboarding_sequence_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM onboarding_sequences s
      WHERE s.id = onboarding_sequence_steps.sequence_id
      AND has_agency_access(auth.uid(), s.agency_id)
    )
  );

CREATE POLICY onboarding_sequence_steps_delete_policy ON onboarding_sequence_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM onboarding_sequences s
      WHERE s.id = onboarding_sequence_steps.sequence_id
      AND has_agency_access(auth.uid(), s.agency_id)
    )
  );

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_sequence_steps TO authenticated;

-- ============================================
-- TABLE: onboarding_instances
-- Assigned sequence to a customer/sale
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES onboarding_sequences(id) ON DELETE RESTRICT,

  -- Link to sale (when we have sales table)
  sale_id UUID,

  -- Customer info (denormalized for easy access)
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,

  -- Assignment
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timing
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Status
  status onboarding_instance_status NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure at least one assignee type
  CONSTRAINT onboarding_instances_assignee_check CHECK (
    assigned_to_user_id IS NOT NULL OR assigned_to_staff_user_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_agency_id ON onboarding_instances(agency_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_sequence_id ON onboarding_instances(sequence_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_assigned_user ON onboarding_instances(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_assigned_staff ON onboarding_instances(assigned_to_staff_user_id) WHERE assigned_to_staff_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_status ON onboarding_instances(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_sale_id ON onboarding_instances(sale_id) WHERE sale_id IS NOT NULL;

-- RLS
ALTER TABLE onboarding_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_instances_select_policy ON onboarding_instances
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_instances_insert_policy ON onboarding_instances
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_instances_update_policy ON onboarding_instances
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_instances_delete_policy ON onboarding_instances
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_instances TO authenticated;

-- ============================================
-- TABLE: onboarding_tasks
-- Individual tasks generated from sequence steps
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES onboarding_instances(id) ON DELETE CASCADE,
  step_id UUID REFERENCES onboarding_sequence_steps(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Assignment (denormalized from instance for query performance)
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,

  -- Task details (copied from step, allows template changes without affecting active tasks)
  day_number INTEGER NOT NULL,
  action_type onboarding_action_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  script_template TEXT,

  -- Scheduling
  due_date DATE NOT NULL,

  -- Status and completion
  status onboarding_task_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  completion_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_instance_id ON onboarding_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_agency_id ON onboarding_tasks(agency_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assigned_user ON onboarding_tasks(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assigned_staff ON onboarding_tasks(assigned_to_staff_user_id) WHERE assigned_to_staff_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_due_date ON onboarding_tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_agency_due_status ON onboarding_tasks(agency_id, due_date, status);

-- RLS
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_tasks_select_policy ON onboarding_tasks
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_tasks_insert_policy ON onboarding_tasks
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_tasks_update_policy ON onboarding_tasks
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY onboarding_tasks_delete_policy ON onboarding_tasks
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_tasks TO authenticated;

-- ============================================
-- FUNCTION: calculate_business_day_due_date
-- Calculates due date by adding business days (skipping weekends)
-- ============================================
CREATE OR REPLACE FUNCTION calculate_business_day_due_date(
  p_start_date DATE,
  p_day_offset INTEGER
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_current_date DATE := p_start_date;
  v_days_added INTEGER := 0;
BEGIN
  -- If offset is 0, return start date
  IF p_day_offset = 0 THEN
    RETURN p_start_date;
  END IF;

  -- Add days, skipping weekends
  WHILE v_days_added < p_day_offset LOOP
    v_current_date := v_current_date + INTERVAL '1 day';

    -- Skip Saturday (6) and Sunday (0)
    IF EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
      v_days_added := v_days_added + 1;
    END IF;
  END LOOP;

  RETURN v_current_date;
END;
$$;

-- ============================================
-- FUNCTION: initialize_onboarding_tasks
-- Creates tasks from sequence steps when instance is created
-- Uses SECURITY DEFINER to bypass RLS (runs as function owner)
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_initialize_onboarding_tasks ON onboarding_instances;
CREATE TRIGGER trg_initialize_onboarding_tasks
  AFTER INSERT ON onboarding_instances
  FOR EACH ROW
  EXECUTE FUNCTION initialize_onboarding_tasks();

-- ============================================
-- FUNCTION: sync_new_sequence_steps
-- When a new step is added to a template, add it to all active instances
-- Uses SECURITY DEFINER to bypass RLS
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_new_sequence_steps ON onboarding_sequence_steps;
CREATE TRIGGER trg_sync_new_sequence_steps
  AFTER INSERT ON onboarding_sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION sync_new_sequence_steps();

-- ============================================
-- FUNCTION: update_instance_on_task_complete
-- Updates instance status when all tasks are completed
-- Uses SECURITY DEFINER to bypass RLS
-- ============================================
CREATE OR REPLACE FUNCTION update_instance_on_task_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incomplete_count INTEGER;
BEGIN
  -- Only check when task is marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Count incomplete tasks for this instance
    SELECT COUNT(*) INTO v_incomplete_count
    FROM onboarding_tasks
    WHERE instance_id = NEW.instance_id
    AND status != 'completed';

    -- If all tasks complete, mark instance as completed
    IF v_incomplete_count = 0 THEN
      UPDATE onboarding_instances
      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.instance_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_instance_on_task_complete ON onboarding_tasks;
CREATE TRIGGER trg_update_instance_on_task_complete
  AFTER UPDATE OF status ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_on_task_complete();

-- ============================================
-- FUNCTION: update_updated_at_timestamp
-- Generic trigger function to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trg_onboarding_sequences_updated_at ON onboarding_sequences;
CREATE TRIGGER trg_onboarding_sequences_updated_at
  BEFORE UPDATE ON onboarding_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_sequence_steps_updated_at ON onboarding_sequence_steps;
CREATE TRIGGER trg_onboarding_sequence_steps_updated_at
  BEFORE UPDATE ON onboarding_sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_instances_updated_at ON onboarding_instances;
CREATE TRIGGER trg_onboarding_instances_updated_at
  BEFORE UPDATE ON onboarding_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_tasks_updated_at ON onboarding_tasks;
CREATE TRIGGER trg_onboarding_tasks_updated_at
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

-- ============================================
-- Add to Supabase Realtime publication
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_sequences;
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_sequence_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_tasks;

-- ============================================
-- COMMENTS for documentation
-- ============================================
COMMENT ON TABLE onboarding_sequences IS 'Sequence templates created by agency managers. Each template contains multiple steps that define follow-up actions.';
COMMENT ON TABLE onboarding_sequence_steps IS 'Individual steps within a sequence template. Steps define the day, action type, and content of each follow-up task.';
COMMENT ON TABLE onboarding_instances IS 'Represents an assigned sequence to a specific customer/sale. Links a template to actual tasks.';
COMMENT ON TABLE onboarding_tasks IS 'Individual tasks generated from sequence steps. These are the actual to-do items that staff complete.';
COMMENT ON FUNCTION calculate_business_day_due_date IS 'Calculates due date by adding business days (Mon-Fri) from a start date.';
COMMENT ON FUNCTION initialize_onboarding_tasks IS 'Trigger function: Creates tasks from sequence steps when a new instance is created.';
COMMENT ON FUNCTION sync_new_sequence_steps IS 'Trigger function: Adds new tasks to active instances when a step is added to a template.';
COMMENT ON FUNCTION update_instance_on_task_complete IS 'Trigger function: Marks instance as completed when all tasks are done.';
