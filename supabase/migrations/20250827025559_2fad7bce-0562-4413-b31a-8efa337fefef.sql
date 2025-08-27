-- Add team assignment field for hybrid team members
ALTER TABLE public.team_members 
ADD COLUMN hybrid_team_assignments text[] DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.team_members.hybrid_team_assignments IS 
'For hybrid role members: array of teams they count for (''Sales'', ''Service'', or both)';

-- Create index for efficient querying
CREATE INDEX idx_team_members_hybrid_assignments ON public.team_members USING GIN (hybrid_team_assignments);