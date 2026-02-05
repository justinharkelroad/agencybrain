-- Fix: initialize_onboarding_tasks trigger was missing required NOT NULL columns
-- and referenced a non-existent sale_id column on onboarding_tasks.
--
-- The trigger was rewritten in 20260203201814_add_lqs_objections_table.sql but
-- dropped day_number, action_type, title, description, and script_template
-- from the INSERT. This caused a 500 error when applying any sequence.

-- Step 1: Add sale_id column to onboarding_tasks (denormalized from instance)
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_sale_id
  ON public.onboarding_tasks(sale_id) WHERE sale_id IS NOT NULL;

-- Step 2: Fix the trigger function with all required columns
CREATE OR REPLACE FUNCTION initialize_onboarding_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
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
        sale_id,
        household_id,
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
        NEW.sale_id,
        NEW.household_id,
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

-- Step 3: Also fix sync_new_sequence_steps to include sale_id and household_id
CREATE OR REPLACE FUNCTION sync_new_sequence_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_instance IN
      SELECT * FROM onboarding_instances
      WHERE sequence_id = NEW.sequence_id
      AND status = 'active'
    LOOP
      IF calculate_business_day_due_date(v_instance.start_date, NEW.day_number) >= CURRENT_DATE THEN
        INSERT INTO onboarding_tasks (
          instance_id,
          step_id,
          agency_id,
          contact_id,
          sale_id,
          household_id,
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
          v_instance.sale_id,
          v_instance.household_id,
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
