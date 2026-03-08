-- =====================================================
-- Mission Control Coach Notes
-- Private coach/admin notes for a selected owner workspace.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mission_control_coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.mission_control_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  note_body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_control_coach_notes_owner_updated
  ON public.mission_control_coach_notes(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mission_control_coach_notes_session
  ON public.mission_control_coach_notes(session_id);

CREATE OR REPLACE FUNCTION public.validate_mission_control_coach_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.owner_user_id
      AND p.agency_id = NEW.agency_id
  ) THEN
    RAISE EXCEPTION 'Mission control coach note owner must belong to the same agency.';
  END IF;

  IF NEW.session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.mission_control_sessions s
    WHERE s.id = NEW.session_id
      AND s.owner_user_id = NEW.owner_user_id
      AND s.agency_id = NEW.agency_id
  ) THEN
    RAISE EXCEPTION 'Mission control coach note session must belong to the same owner workspace.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mission_control_coach_notes ON public.mission_control_coach_notes;
CREATE TRIGGER validate_mission_control_coach_notes
BEFORE INSERT OR UPDATE ON public.mission_control_coach_notes
FOR EACH ROW
EXECUTE FUNCTION public.validate_mission_control_coach_note();

DROP TRIGGER IF EXISTS set_updated_at_mission_control_coach_notes ON public.mission_control_coach_notes;
CREATE TRIGGER set_updated_at_mission_control_coach_notes
BEFORE UPDATE ON public.mission_control_coach_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mission_control_coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_control_coach_notes_admin_select ON public.mission_control_coach_notes;
CREATE POLICY mission_control_coach_notes_admin_select
ON public.mission_control_coach_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS mission_control_coach_notes_admin_insert ON public.mission_control_coach_notes;
CREATE POLICY mission_control_coach_notes_admin_insert
ON public.mission_control_coach_notes
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS mission_control_coach_notes_admin_update ON public.mission_control_coach_notes;
CREATE POLICY mission_control_coach_notes_admin_update
ON public.mission_control_coach_notes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS mission_control_coach_notes_admin_delete ON public.mission_control_coach_notes;
CREATE POLICY mission_control_coach_notes_admin_delete
ON public.mission_control_coach_notes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_coach_notes TO authenticated;
GRANT ALL ON public.mission_control_coach_notes TO service_role;
