-- Add foreign key constraint for quoted_household_details -> submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'qhd_submission_fk'
      AND c.conrelid = 'quoted_household_details'::regclass
  ) THEN
    ALTER TABLE quoted_household_details
      ADD CONSTRAINT qhd_submission_fk
      FOREIGN KEY (submission_id) REFERENCES submissions(id);
  END IF;
END $$;

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
