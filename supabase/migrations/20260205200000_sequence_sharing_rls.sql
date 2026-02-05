-- Migration: Add RLS policies for public sequence sharing
-- Allows authenticated users to read public sequences from any agency for the community library

-- Allow reading public sequences from any agency
CREATE POLICY onboarding_sequences_public_read ON onboarding_sequences
  FOR SELECT
  USING (is_public = true);

-- Allow reading steps for public sequences
CREATE POLICY onboarding_sequence_steps_public_read ON onboarding_sequence_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_sequences s
      WHERE s.id = onboarding_sequence_steps.sequence_id
      AND s.is_public = true
    )
  );

-- Function to increment clone_count when a sequence is cloned
-- Uses SECURITY DEFINER to allow updating sequences across agencies
CREATE OR REPLACE FUNCTION increment_sequence_clone_count(p_sequence_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE onboarding_sequences
  SET clone_count = clone_count + 1,
      updated_at = NOW()
  WHERE id = p_sequence_id
  AND is_public = true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_sequence_clone_count(UUID) TO authenticated;

COMMENT ON FUNCTION increment_sequence_clone_count IS 'Increments clone_count for a public sequence when it is cloned. Uses SECURITY DEFINER to allow cross-agency updates.';
