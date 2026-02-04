-- Drop the incorrect constraint
ALTER TABLE sales_experience_assignments 
DROP CONSTRAINT IF EXISTS one_active_per_agency;

-- Create correct partial unique index
-- This allows only ONE assignment per agency that is pending, active, or paused
-- But allows unlimited cancelled or completed assignments (historical records)
CREATE UNIQUE INDEX one_active_per_agency 
ON sales_experience_assignments(agency_id) 
WHERE status IN ('pending', 'active', 'paused');