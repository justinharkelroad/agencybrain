-- SP Assignments: allow agency owners/managers to assign SP categories to staff
CREATE TABLE public.sp_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  sp_category_id uuid NOT NULL REFERENCES sp_categories(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  assigned_by_user_id uuid REFERENCES auth.users(id),
  assigned_by_staff_id uuid REFERENCES staff_users(id),
  seen_at timestamptz,
  CONSTRAINT must_have_assigner CHECK (
    assigned_by_user_id IS NOT NULL OR assigned_by_staff_id IS NOT NULL
  ),
  UNIQUE(staff_user_id, sp_category_id)
);

-- Indexes
CREATE INDEX idx_sp_assignments_staff_user ON sp_assignments(staff_user_id);
CREATE INDEX idx_sp_assignments_category ON sp_assignments(sp_category_id);
CREATE INDEX idx_sp_assignments_agency ON sp_assignments(agency_id);
CREATE INDEX idx_sp_assignments_unseen ON sp_assignments(staff_user_id) WHERE seen_at IS NULL;

-- RLS
ALTER TABLE sp_assignments ENABLE ROW LEVEL SECURITY;

-- Owners/key employees/staff managers can view assignments in their agency
CREATE POLICY "sp_assignments_select"
  ON sp_assignments FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Owners/key employees can insert assignments (JWT path)
CREATE POLICY "sp_assignments_insert"
  ON sp_assignments FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Owners/key employees can update assignments (JWT path)
CREATE POLICY "sp_assignments_update"
  ON sp_assignments FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

-- Owners/key employees can delete assignments (JWT path)
CREATE POLICY "sp_assignments_delete"
  ON sp_assignments FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Service role policy for edge functions (staff manager path)
CREATE POLICY "sp_assignments_service_role"
  ON sp_assignments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant to service_role is implicit, but explicit grant for edge function access
GRANT ALL ON sp_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sp_assignments TO authenticated;
