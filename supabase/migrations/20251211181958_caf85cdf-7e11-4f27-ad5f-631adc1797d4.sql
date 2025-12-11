-- First, delete orphaned sold_policy_details records that reference non-existent submissions
DELETE FROM sold_policy_details 
WHERE submission_id NOT IN (SELECT id FROM submissions);

-- Now add the foreign key constraint
ALTER TABLE sold_policy_details 
ADD CONSTRAINT sold_policy_details_submission_id_fkey 
FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;