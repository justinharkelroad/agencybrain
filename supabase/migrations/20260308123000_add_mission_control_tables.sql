-- =====================================================
-- Mission Control
-- Owner-only 1:1 workspace for coaching sessions, commitments,
-- mission board items, and supporting attachments.
-- =====================================================

-- =====================================================
-- 1. ACCESS HELPERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_mission_control_access(
  _user_id uuid,
  _agency_id uuid,
  _owner_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = COALESCE(_user_id, auth.uid())
      AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = COALESCE(_user_id, auth.uid())
      AND p.id = _owner_user_id
      AND p.agency_id = _agency_id
      AND p.membership_tier = '1:1 Coaching'
      AND public.has_feature_access(_agency_id, 'mission_control')
      AND NOT EXISTS (
        SELECT 1
        FROM public.key_employees ke
        WHERE ke.user_id = p.id
          AND ke.agency_id = _agency_id
      )
  );
$$;

COMMENT ON FUNCTION public.has_mission_control_access(uuid, uuid, uuid)
IS 'Returns true for admins or for the true 1:1 agency owner tied to the agency and mission_control feature flag.';

CREATE OR REPLACE FUNCTION public.can_link_mission_control_upload(
  _user_id uuid,
  _agency_id uuid,
  _owner_user_id uuid,
  _upload_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_mission_control_access(_user_id, _agency_id, _owner_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.uploads u
      WHERE u.id = _upload_id
        AND (
          u.user_id = _owner_user_id
          OR u.user_id = COALESCE(_user_id, auth.uid())
        )
    );
$$;

COMMENT ON FUNCTION public.can_link_mission_control_upload(uuid, uuid, uuid, uuid)
IS 'Ensures mission control attachments only point at uploads created by the owner or the acting admin.';

-- =====================================================
-- 2. TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mission_control_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'reviewed')),
  transcript_text text,
  summary_ai text,
  key_points_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  wins_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_commitments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_call_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_control_sessions_key_points_array CHECK (jsonb_typeof(key_points_json) = 'array'),
  CONSTRAINT mission_control_sessions_wins_array CHECK (jsonb_typeof(wins_json) = 'array'),
  CONSTRAINT mission_control_sessions_issues_array CHECK (jsonb_typeof(issues_json) = 'array'),
  CONSTRAINT mission_control_sessions_commitments_array CHECK (jsonb_typeof(top_commitments_json) = 'array')
);

CREATE TABLE IF NOT EXISTS public.mission_control_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.mission_control_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked', 'carried_forward')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date date,
  proof_required boolean NOT NULL DEFAULT false,
  proof_status text NOT NULL DEFAULT 'not_required' CHECK (proof_status IN ('not_required', 'pending', 'submitted', 'accepted')),
  proof_notes text,
  reviewed_in_session_id uuid REFERENCES public.mission_control_sessions(id) ON DELETE SET NULL,
  carried_forward_from_commitment_id uuid REFERENCES public.mission_control_commitments(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_control_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_session_id uuid REFERENCES public.mission_control_sessions(id) ON DELETE SET NULL,
  source_commitment_id uuid REFERENCES public.mission_control_commitments(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  column_status text NOT NULL DEFAULT 'backlog' CHECK (column_status IN ('backlog', 'in_progress', 'before_next_call', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  proof_required boolean NOT NULL DEFAULT false,
  proof_status text NOT NULL DEFAULT 'not_required' CHECK (proof_status IN ('not_required', 'pending', 'submitted', 'accepted')),
  column_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_control_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.mission_control_sessions(id) ON DELETE CASCADE,
  commitment_id uuid REFERENCES public.mission_control_commitments(id) ON DELETE CASCADE,
  board_item_id uuid REFERENCES public.mission_control_board_items(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('transcript', 'proof', 'reference', 'artifact')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_control_attachments_single_parent
    CHECK (num_nonnulls(session_id, commitment_id, board_item_id) = 1)
);

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_mission_control_sessions_owner_date
  ON public.mission_control_sessions(owner_user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_mission_control_sessions_agency_date
  ON public.mission_control_sessions(agency_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_mission_control_sessions_period
  ON public.mission_control_sessions(period_id);

CREATE INDEX IF NOT EXISTS idx_mission_control_commitments_owner_status
  ON public.mission_control_commitments(owner_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_mission_control_commitments_session
  ON public.mission_control_commitments(session_id);
CREATE INDEX IF NOT EXISTS idx_mission_control_commitments_reviewed_session
  ON public.mission_control_commitments(reviewed_in_session_id);

CREATE INDEX IF NOT EXISTS idx_mission_control_board_items_owner_column
  ON public.mission_control_board_items(owner_user_id, column_status, column_order);
CREATE INDEX IF NOT EXISTS idx_mission_control_board_items_source_session
  ON public.mission_control_board_items(source_session_id);
CREATE INDEX IF NOT EXISTS idx_mission_control_board_items_source_commitment
  ON public.mission_control_board_items(source_commitment_id);

CREATE INDEX IF NOT EXISTS idx_mission_control_attachments_session
  ON public.mission_control_attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_mission_control_attachments_commitment
  ON public.mission_control_attachments(commitment_id);
CREATE INDEX IF NOT EXISTS idx_mission_control_attachments_board_item
  ON public.mission_control_attachments(board_item_id);
CREATE INDEX IF NOT EXISTS idx_mission_control_attachments_upload
  ON public.mission_control_attachments(upload_id);

-- =====================================================
-- 4. VALIDATION + TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_mission_control_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'mission_control_sessions' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = NEW.owner_user_id
        AND p.agency_id = NEW.agency_id
    ) THEN
      RAISE EXCEPTION 'Mission control session owner must belong to the same agency.';
    END IF;

    IF NEW.period_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.periods pe
      WHERE pe.id = NEW.period_id
        AND pe.user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control session period must belong to the same owner.';
    END IF;
  ELSIF TG_TABLE_NAME = 'mission_control_commitments' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.mission_control_sessions s
      WHERE s.id = NEW.session_id
        AND s.agency_id = NEW.agency_id
        AND s.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control commitment must reference a session owned by the same agency owner.';
    END IF;

    IF NEW.reviewed_in_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_sessions s
      WHERE s.id = NEW.reviewed_in_session_id
        AND s.agency_id = NEW.agency_id
        AND s.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control commitment review session must belong to the same agency owner.';
    END IF;

    IF NEW.carried_forward_from_commitment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_commitments c
      WHERE c.id = NEW.carried_forward_from_commitment_id
        AND c.agency_id = NEW.agency_id
        AND c.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control carried-forward commitment must belong to the same agency owner.';
    END IF;
  ELSIF TG_TABLE_NAME = 'mission_control_board_items' THEN
    IF NEW.source_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_sessions s
      WHERE s.id = NEW.source_session_id
        AND s.agency_id = NEW.agency_id
        AND s.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control board item source session must belong to the same agency owner.';
    END IF;

    IF NEW.source_commitment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_commitments c
      WHERE c.id = NEW.source_commitment_id
        AND c.agency_id = NEW.agency_id
        AND c.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control board item source commitment must belong to the same agency owner.';
    END IF;
  ELSIF TG_TABLE_NAME = 'mission_control_attachments' THEN
    IF NEW.session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_sessions s
      WHERE s.id = NEW.session_id
        AND s.agency_id = NEW.agency_id
        AND s.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control attachment session must belong to the same agency owner.';
    END IF;

    IF NEW.commitment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_commitments c
      WHERE c.id = NEW.commitment_id
        AND c.agency_id = NEW.agency_id
        AND c.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control attachment commitment must belong to the same agency owner.';
    END IF;

    IF NEW.board_item_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.mission_control_board_items b
      WHERE b.id = NEW.board_item_id
        AND b.agency_id = NEW.agency_id
        AND b.owner_user_id = NEW.owner_user_id
    ) THEN
      RAISE EXCEPTION 'Mission control attachment board item must belong to the same agency owner.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_mission_control_completion_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'mission_control_commitments' THEN
    IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    ELSIF NEW.status <> 'done' THEN
      NEW.completed_at = NULL;
    END IF;
  ELSIF TG_TABLE_NAME = 'mission_control_board_items' THEN
    IF NEW.column_status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    ELSIF NEW.column_status <> 'done' THEN
      NEW.completed_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mission_control_sessions ON public.mission_control_sessions;
CREATE TRIGGER validate_mission_control_sessions
BEFORE INSERT OR UPDATE ON public.mission_control_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_mission_control_relationships();

DROP TRIGGER IF EXISTS set_updated_at_mission_control_sessions ON public.mission_control_sessions;
CREATE TRIGGER set_updated_at_mission_control_sessions
BEFORE UPDATE ON public.mission_control_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS validate_mission_control_commitments ON public.mission_control_commitments;
CREATE TRIGGER validate_mission_control_commitments
BEFORE INSERT OR UPDATE ON public.mission_control_commitments
FOR EACH ROW
EXECUTE FUNCTION public.validate_mission_control_relationships();

DROP TRIGGER IF EXISTS set_updated_at_mission_control_commitments ON public.mission_control_commitments;
CREATE TRIGGER set_updated_at_mission_control_commitments
BEFORE UPDATE ON public.mission_control_commitments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS sync_mission_control_commitments_completion ON public.mission_control_commitments;
CREATE TRIGGER sync_mission_control_commitments_completion
BEFORE INSERT OR UPDATE ON public.mission_control_commitments
FOR EACH ROW
EXECUTE FUNCTION public.sync_mission_control_completion_timestamps();

DROP TRIGGER IF EXISTS validate_mission_control_board_items ON public.mission_control_board_items;
CREATE TRIGGER validate_mission_control_board_items
BEFORE INSERT OR UPDATE ON public.mission_control_board_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_mission_control_relationships();

DROP TRIGGER IF EXISTS set_updated_at_mission_control_board_items ON public.mission_control_board_items;
CREATE TRIGGER set_updated_at_mission_control_board_items
BEFORE UPDATE ON public.mission_control_board_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS sync_mission_control_board_items_completion ON public.mission_control_board_items;
CREATE TRIGGER sync_mission_control_board_items_completion
BEFORE INSERT OR UPDATE ON public.mission_control_board_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_mission_control_completion_timestamps();

DROP TRIGGER IF EXISTS validate_mission_control_attachments ON public.mission_control_attachments;
CREATE TRIGGER validate_mission_control_attachments
BEFORE INSERT OR UPDATE ON public.mission_control_attachments
FOR EACH ROW
EXECUTE FUNCTION public.validate_mission_control_relationships();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.mission_control_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_control_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_control_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_control_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_control_sessions_select ON public.mission_control_sessions;
CREATE POLICY mission_control_sessions_select
ON public.mission_control_sessions
FOR SELECT
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_sessions_insert ON public.mission_control_sessions;
CREATE POLICY mission_control_sessions_insert
ON public.mission_control_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_sessions_update ON public.mission_control_sessions;
CREATE POLICY mission_control_sessions_update
ON public.mission_control_sessions
FOR UPDATE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id))
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_sessions_delete ON public.mission_control_sessions;
CREATE POLICY mission_control_sessions_delete
ON public.mission_control_sessions
FOR DELETE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_commitments_select ON public.mission_control_commitments;
CREATE POLICY mission_control_commitments_select
ON public.mission_control_commitments
FOR SELECT
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_commitments_insert ON public.mission_control_commitments;
CREATE POLICY mission_control_commitments_insert
ON public.mission_control_commitments
FOR INSERT
TO authenticated
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_commitments_update ON public.mission_control_commitments;
CREATE POLICY mission_control_commitments_update
ON public.mission_control_commitments
FOR UPDATE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id))
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_commitments_delete ON public.mission_control_commitments;
CREATE POLICY mission_control_commitments_delete
ON public.mission_control_commitments
FOR DELETE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_board_items_select ON public.mission_control_board_items;
CREATE POLICY mission_control_board_items_select
ON public.mission_control_board_items
FOR SELECT
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_board_items_insert ON public.mission_control_board_items;
CREATE POLICY mission_control_board_items_insert
ON public.mission_control_board_items
FOR INSERT
TO authenticated
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_board_items_update ON public.mission_control_board_items;
CREATE POLICY mission_control_board_items_update
ON public.mission_control_board_items
FOR UPDATE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id))
WITH CHECK (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_board_items_delete ON public.mission_control_board_items;
CREATE POLICY mission_control_board_items_delete
ON public.mission_control_board_items
FOR DELETE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_attachments_select ON public.mission_control_attachments;
CREATE POLICY mission_control_attachments_select
ON public.mission_control_attachments
FOR SELECT
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

DROP POLICY IF EXISTS mission_control_attachments_insert ON public.mission_control_attachments;
CREATE POLICY mission_control_attachments_insert
ON public.mission_control_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_mission_control_access(auth.uid(), agency_id, owner_user_id)
  AND public.can_link_mission_control_upload(auth.uid(), agency_id, owner_user_id, upload_id)
);

DROP POLICY IF EXISTS mission_control_attachments_update ON public.mission_control_attachments;
CREATE POLICY mission_control_attachments_update
ON public.mission_control_attachments
FOR UPDATE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id))
WITH CHECK (
  public.has_mission_control_access(auth.uid(), agency_id, owner_user_id)
  AND public.can_link_mission_control_upload(auth.uid(), agency_id, owner_user_id, upload_id)
);

DROP POLICY IF EXISTS mission_control_attachments_delete ON public.mission_control_attachments;
CREATE POLICY mission_control_attachments_delete
ON public.mission_control_attachments
FOR DELETE
TO authenticated
USING (public.has_mission_control_access(auth.uid(), agency_id, owner_user_id));

-- =====================================================
-- 6. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.has_mission_control_access(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_link_mission_control_upload(uuid, uuid, uuid, uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_commitments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_board_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_control_attachments TO authenticated;

GRANT ALL ON public.mission_control_sessions TO service_role;
GRANT ALL ON public.mission_control_commitments TO service_role;
GRANT ALL ON public.mission_control_board_items TO service_role;
GRANT ALL ON public.mission_control_attachments TO service_role;
