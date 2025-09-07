-- Add foreign key constraint for quoted_household_details -> submissions
ALTER TABLE quoted_household_details
  ADD CONSTRAINT qhd_submission_fk
  FOREIGN KEY (submission_id) REFERENCES submissions(id);

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');