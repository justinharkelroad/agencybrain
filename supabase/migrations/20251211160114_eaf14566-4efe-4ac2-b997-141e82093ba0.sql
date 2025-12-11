-- Add public read access policy for active policy types
-- Policy types are non-sensitive configuration data (just names like "Auto Insurance")
-- This allows staff users (who lack auth.uid()) to load policy type options

CREATE POLICY "Anyone can read active policy types" 
ON policy_types FOR SELECT 
USING (is_active = true);