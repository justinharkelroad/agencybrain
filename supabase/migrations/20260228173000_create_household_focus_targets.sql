-- Persistent planner targets for Household Focus (team defaults + member-specific targets)
CREATE TABLE IF NOT EXISTS public.household_focus_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('items', 'commission')),
  target_items integer NOT NULL CHECK (target_items >= 1),
  target_commission integer NOT NULL CHECK (target_commission >= 0),
  close_rate numeric(6,2) NOT NULL CHECK (close_rate >= 0 AND close_rate <= 100),
  avg_items_per_household numeric(6,2) NOT NULL CHECK (avg_items_per_household > 0),
  avg_policies_per_household numeric(6,2) NOT NULL CHECK (avg_policies_per_household > 0),
  avg_value_per_item integer NOT NULL CHECK (avg_value_per_item >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One team default per agency (team_member_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_focus_targets_team_default
  ON public.household_focus_targets(agency_id)
  WHERE team_member_id IS NULL;

-- One override per team member per agency
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_focus_targets_member
  ON public.household_focus_targets(agency_id, team_member_id)
  WHERE team_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_household_focus_targets_agency
  ON public.household_focus_targets(agency_id);

CREATE INDEX IF NOT EXISTS idx_household_focus_targets_member
  ON public.household_focus_targets(team_member_id)
  WHERE team_member_id IS NOT NULL;

ALTER TABLE public.household_focus_targets ENABLE ROW LEVEL SECURITY;

-- Access is mediated by edge functions using service role.
-- Keep direct client policies restrictive.
DROP POLICY IF EXISTS "read own agency household focus targets" ON public.household_focus_targets;
CREATE POLICY "read own agency household focus targets"
ON public.household_focus_targets
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = household_focus_targets.agency_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.key_employees ke
    WHERE ke.user_id = auth.uid()
      AND ke.agency_id = household_focus_targets.agency_id
  )
);

DROP POLICY IF EXISTS "manage own agency household focus targets" ON public.household_focus_targets;
CREATE POLICY "manage own agency household focus targets"
ON public.household_focus_targets
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = household_focus_targets.agency_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.key_employees ke
    WHERE ke.user_id = auth.uid()
      AND ke.agency_id = household_focus_targets.agency_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = household_focus_targets.agency_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.key_employees ke
    WHERE ke.user_id = auth.uid()
      AND ke.agency_id = household_focus_targets.agency_id
  )
);

DROP TRIGGER IF EXISTS trg_household_focus_targets_updated_at ON public.household_focus_targets;
CREATE TRIGGER trg_household_focus_targets_updated_at
  BEFORE UPDATE ON public.household_focus_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
