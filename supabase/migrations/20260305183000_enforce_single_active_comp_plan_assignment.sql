-- Enforce exactly one active compensation plan assignment per team member.
-- This protects comp payout calculation from ambiguous plan selection.

CREATE OR REPLACE FUNCTION public.enforce_single_active_comp_plan_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_plan_name text;
  conflicting_member_name text;
BEGIN
  IF NEW.end_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT cp.name, tm.name
  INTO conflicting_plan_name, conflicting_member_name
  FROM public.comp_plan_assignments cpa
  JOIN public.comp_plans cp ON cp.id = cpa.comp_plan_id
  JOIN public.team_members tm ON tm.id = cpa.team_member_id
  WHERE cpa.team_member_id = NEW.team_member_id
    AND cpa.end_date IS NULL
    AND cpa.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF conflicting_plan_name IS NOT NULL THEN
    RAISE EXCEPTION '% is already assigned to "%". Remove that active compensation plan assignment before creating another one.',
      COALESCE(conflicting_member_name, 'This team member'),
      conflicting_plan_name
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_active_comp_plan_assignment
ON public.comp_plan_assignments;

CREATE TRIGGER enforce_single_active_comp_plan_assignment
BEFORE INSERT OR UPDATE OF team_member_id, end_date
ON public.comp_plan_assignments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_comp_plan_assignment();
