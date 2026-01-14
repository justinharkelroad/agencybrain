-- Add assigned_team_member_id column to cancel_audit_records
ALTER TABLE public.cancel_audit_records
ADD COLUMN assigned_team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Create index for faster lookups by assigned team member
CREATE INDEX idx_cancel_audit_records_assigned_member ON public.cancel_audit_records(assigned_team_member_id);

-- Add RLS policy for team members to see their assigned records
-- (Existing policies should already cover access based on agency_id)