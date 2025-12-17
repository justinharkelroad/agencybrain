-- Add team_member_id column to focus_items for staff access
ALTER TABLE public.focus_items ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_focus_items_team_member_id ON public.focus_items(team_member_id);

-- Comment explaining the column
COMMENT ON COLUMN public.focus_items.team_member_id IS 'Links focus items to team members, enabling staff access via custom auth sessions';