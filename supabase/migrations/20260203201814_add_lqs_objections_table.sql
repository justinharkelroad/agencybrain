-- Create lqs_objections table (GLOBAL - not agency-scoped)
-- Managed by admins, shared across all agencies
CREATE TABLE public.lqs_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for active objections
CREATE INDEX idx_lqs_objections_active ON public.lqs_objections(is_active) WHERE is_active = true;

-- RLS policies (all authenticated users can view active, admins can manage)
ALTER TABLE public.lqs_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active objections"
  ON public.lqs_objections FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all objections"
  ON public.lqs_objections FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert objections"
  ON public.lqs_objections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update objections"
  ON public.lqs_objections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete objections"
  ON public.lqs_objections FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lqs_objections TO authenticated;

-- Add objection_id to lqs_households
ALTER TABLE public.lqs_households
  ADD COLUMN objection_id uuid REFERENCES public.lqs_objections(id) ON DELETE SET NULL;

CREATE INDEX idx_lqs_households_objection ON public.lqs_households(objection_id);

-- Add household_id to onboarding_instances for LQS integration
ALTER TABLE public.onboarding_instances
  ADD COLUMN household_id uuid REFERENCES public.lqs_households(id) ON DELETE SET NULL;

CREATE INDEX idx_onboarding_instances_household ON public.onboarding_instances(household_id) WHERE household_id IS NOT NULL;

-- Update constraint: require at least one of contact_id, sale_id, or household_id
-- First drop existing constraint if it exists
ALTER TABLE public.onboarding_instances
  DROP CONSTRAINT IF EXISTS onboarding_instances_contact_or_sale_check;

ALTER TABLE public.onboarding_instances
  ADD CONSTRAINT onboarding_instances_entity_check
  CHECK (contact_id IS NOT NULL OR sale_id IS NOT NULL OR household_id IS NOT NULL);

-- Add household_id to onboarding_tasks (denormalized for efficient queries)
ALTER TABLE public.onboarding_tasks
  ADD COLUMN household_id uuid REFERENCES public.lqs_households(id) ON DELETE SET NULL;

CREATE INDEX idx_onboarding_tasks_household ON public.onboarding_tasks(household_id) WHERE household_id IS NOT NULL;

-- Create or replace function to initialize onboarding tasks with household_id
CREATE OR REPLACE FUNCTION initialize_onboarding_tasks()
RETURNS TRIGGER AS $$
DECLARE
  step_record RECORD;
  task_due_date DATE;
BEGIN
  -- Get all steps for the sequence and create tasks
  FOR step_record IN
    SELECT * FROM onboarding_sequence_steps
    WHERE sequence_id = NEW.sequence_id
    ORDER BY day_number
  LOOP
    -- Calculate due date based on start_date + day_number
    task_due_date := NEW.start_date + step_record.day_number;

    INSERT INTO onboarding_tasks (
      instance_id,
      step_id,
      agency_id,
      contact_id,
      sale_id,
      household_id,
      assigned_to_staff_user_id,
      assigned_to_user_id,
      due_date,
      status
    ) VALUES (
      NEW.id,
      step_record.id,
      NEW.agency_id,
      NEW.contact_id,
      NEW.sale_id,
      NEW.household_id,
      NEW.assigned_to_staff_user_id,
      NEW.assigned_to_user_id,
      task_due_date,
      'pending'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
