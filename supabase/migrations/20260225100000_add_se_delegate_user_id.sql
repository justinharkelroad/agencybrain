-- Add delegate_user_id to sales_experience_assignments
-- Allows agency owners to grant a delegate (e.g., a manager) full access to the 8-Week Sales Experience dashboard
ALTER TABLE sales_experience_assignments
  ADD COLUMN delegate_user_id uuid REFERENCES profiles(id);

-- Filtered index for delegate lookups
CREATE INDEX idx_se_assignments_delegate
  ON sales_experience_assignments (delegate_user_id)
  WHERE delegate_user_id IS NOT NULL;
