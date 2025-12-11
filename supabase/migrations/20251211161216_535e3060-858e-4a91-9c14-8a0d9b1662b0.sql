-- Add public read access policy for active lead sources
-- Lead sources are non-sensitive configuration data (just names like "Referral", "Website")
-- This allows staff users (who lack auth.uid()) to load lead source options

CREATE POLICY "Anyone can read active lead sources" 
ON lead_sources FOR SELECT 
USING (is_active = true);