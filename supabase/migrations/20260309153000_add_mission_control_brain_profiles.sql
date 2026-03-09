-- =====================================================
-- Mission Control Brain Profiles
-- Admin-only global coaching voice + doctrine documents.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mission_control_brain_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE CHECK (profile_key IN ('justin_voice', 'standard_doctrine')),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_control_brain_profiles_key
  ON public.mission_control_brain_profiles(profile_key);

DROP TRIGGER IF EXISTS set_updated_at_mission_control_brain_profiles ON public.mission_control_brain_profiles;
CREATE TRIGGER set_updated_at_mission_control_brain_profiles
BEFORE UPDATE ON public.mission_control_brain_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mission_control_brain_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_control_brain_profiles_admin_select ON public.mission_control_brain_profiles;
CREATE POLICY mission_control_brain_profiles_admin_select
ON public.mission_control_brain_profiles
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

DROP POLICY IF EXISTS mission_control_brain_profiles_admin_insert ON public.mission_control_brain_profiles;
CREATE POLICY mission_control_brain_profiles_admin_insert
ON public.mission_control_brain_profiles
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

DROP POLICY IF EXISTS mission_control_brain_profiles_admin_update ON public.mission_control_brain_profiles;
CREATE POLICY mission_control_brain_profiles_admin_update
ON public.mission_control_brain_profiles
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

DROP POLICY IF EXISTS mission_control_brain_profiles_admin_delete ON public.mission_control_brain_profiles;
CREATE POLICY mission_control_brain_profiles_admin_delete
ON public.mission_control_brain_profiles
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_brain_profiles TO authenticated;
GRANT ALL ON public.mission_control_brain_profiles TO service_role;
