-- Add admin INSERT policy for onboarding_tokens
-- (SELECT-only was in the original migration, but admins need to create tokens from the dashboard)
CREATE POLICY "admins_insert_onboarding_tokens"
  ON onboarding_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
