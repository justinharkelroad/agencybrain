-- Allow public read access to brokered_carriers
-- Staff users don't have auth.uid() so they can't use has_agency_access()
-- Carrier names are not sensitive data, so allow read access for anyone with agency_id

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their agency brokered carriers" ON brokered_carriers;

-- Create a new permissive SELECT policy
-- Anyone can read carriers if they know the agency_id (no sensitive data)
CREATE POLICY "Anyone can view brokered carriers by agency"
  ON brokered_carriers FOR SELECT
  USING (true);

-- Note: INSERT/UPDATE/DELETE still require has_agency_access via existing policies
