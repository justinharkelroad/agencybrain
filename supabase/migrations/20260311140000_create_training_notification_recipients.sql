-- Training notification recipients: agency-level list of users who receive
-- emails when staff complete training lessons (SP or agency training).
CREATE TABLE training_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  -- Dual-ID pattern: auth.users-based or staff-based
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES staff_users(id) ON DELETE CASCADE,
  -- Cached for display and email sending (refreshed on save)
  display_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT must_have_recipient CHECK (user_id IS NOT NULL OR staff_user_id IS NOT NULL),
  CONSTRAINT unique_auth_recipient UNIQUE (agency_id, user_id),
  CONSTRAINT unique_staff_recipient UNIQUE (agency_id, staff_user_id)
);

-- RLS
ALTER TABLE training_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency access for training notification recipients"
  ON training_notification_recipients
  FOR ALL
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Grants: authenticated needs full DML for the admin settings UI
GRANT SELECT, INSERT, UPDATE, DELETE ON training_notification_recipients TO authenticated;
-- Anon for edge function reads (service_role bypasses RLS, but anon grant is belt-and-suspenders)
GRANT SELECT ON training_notification_recipients TO anon;

-- Index for fast lookup by agency
CREATE INDEX idx_training_notif_recipients_agency
  ON training_notification_recipients(agency_id);
