-- Fix team_members RLS policy to require authentication and proper agency access
-- Drop the existing permissive policy that may allow unintended access
DROP POLICY IF EXISTS "Team: agency users manage" ON public.team_members;

-- Create new restrictive policies that explicitly require authentication
-- Policy for SELECT operations - users can view team members from their agency
CREATE POLICY "Users can view team members from their agency" 
ON public.team_members 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() IS NOT NULL 
  AND has_agency_access(auth.uid(), agency_id)
);

-- Policy for INSERT operations - users can add team members to their agency
CREATE POLICY "Users can insert team members to their agency" 
ON public.team_members 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_agency_access(auth.uid(), agency_id)
);

-- Policy for UPDATE operations - users can update team members in their agency
CREATE POLICY "Users can update team members in their agency" 
ON public.team_members 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() IS NOT NULL 
  AND has_agency_access(auth.uid(), agency_id)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_agency_access(auth.uid(), agency_id)
);

-- Policy for DELETE operations - users can delete team members from their agency
CREATE POLICY "Users can delete team members from their agency" 
ON public.team_members 
FOR DELETE 
TO authenticated 
USING (
  auth.uid() IS NOT NULL 
  AND has_agency_access(auth.uid(), agency_id)
);