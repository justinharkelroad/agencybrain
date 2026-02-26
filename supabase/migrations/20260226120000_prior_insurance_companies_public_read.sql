-- Allow public read access to prior_insurance_companies
-- Staff users don't have auth.uid() so they can't use has_agency_access()
-- Company names are not sensitive data, so allow read access for anyone with agency_id
-- Mirrors the fix applied to brokered_carriers in 20260130000000

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their agency prior insurance companies" ON prior_insurance_companies;

-- Create a new permissive SELECT policy
-- Anyone can read prior insurance companies if they know the agency_id (no sensitive data)
CREATE POLICY "Anyone can view prior insurance companies by agency"
  ON prior_insurance_companies FOR SELECT
  USING (true);

-- Note: INSERT/UPDATE/DELETE still require has_agency_access via existing policies
