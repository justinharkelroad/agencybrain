CREATE TABLE IF NOT EXISTS public.mission_control_brain_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  next_steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  references_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_question text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_control_brain_messages_owner_created
  ON public.mission_control_brain_messages(owner_user_id, created_at);

ALTER TABLE public.mission_control_brain_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_control_brain_messages_select ON public.mission_control_brain_messages;
CREATE POLICY mission_control_brain_messages_select
ON public.mission_control_brain_messages
FOR SELECT
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_brain_messages_insert ON public.mission_control_brain_messages;
CREATE POLICY mission_control_brain_messages_insert
ON public.mission_control_brain_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_mission_control_access(auth.uid(), agency_id, owner_user_id)
  AND (author_user_id IS NULL OR author_user_id = auth.uid())
);

DROP POLICY IF EXISTS mission_control_brain_messages_delete ON public.mission_control_brain_messages;
CREATE POLICY mission_control_brain_messages_delete
ON public.mission_control_brain_messages
FOR DELETE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

GRANT SELECT, INSERT, DELETE ON public.mission_control_brain_messages TO authenticated;
GRANT ALL ON public.mission_control_brain_messages TO service_role;
