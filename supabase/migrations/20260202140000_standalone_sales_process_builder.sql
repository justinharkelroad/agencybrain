-- =====================================================
-- Standalone Sales Process Builder
-- For 1:1 clients who get access to the Sales Process Builder
-- without being enrolled in the full 8-Week Experience
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- 1.1 Agency Feature Access - Manual flags for special features
CREATE TABLE IF NOT EXISTS public.agency_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(agency_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_agency_feature_access_agency ON public.agency_feature_access(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_feature_access_feature ON public.agency_feature_access(feature_key);

-- 1.2 Standalone Sales Process - Stores the sales process for agencies using the standalone builder
CREATE TABLE IF NOT EXISTS public.standalone_sales_process (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  content_json jsonb NOT NULL DEFAULT '{"rapport": [], "coverage": [], "closing": []}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standalone_sales_process_agency ON public.standalone_sales_process(agency_id);
CREATE INDEX IF NOT EXISTS idx_standalone_sales_process_status ON public.standalone_sales_process(status);

-- 1.3 Standalone Sales Process Sessions - AI Builder conversation history
CREATE TABLE IF NOT EXISTS public.standalone_sales_process_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_process_id uuid NOT NULL REFERENCES public.standalone_sales_process(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_content_json jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standalone_sp_sessions_process ON public.standalone_sales_process_sessions(sales_process_id);
CREATE INDEX IF NOT EXISTS idx_standalone_sp_sessions_user ON public.standalone_sales_process_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_standalone_sp_sessions_status ON public.standalone_sales_process_sessions(status);

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- 2.1 Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_standalone_sp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_standalone_sales_process_updated_at ON public.standalone_sales_process;
CREATE TRIGGER update_standalone_sales_process_updated_at
BEFORE UPDATE ON public.standalone_sales_process
FOR EACH ROW EXECUTE FUNCTION public.update_standalone_sp_updated_at();

DROP TRIGGER IF EXISTS update_standalone_sp_sessions_updated_at ON public.standalone_sales_process_sessions;
CREATE TRIGGER update_standalone_sp_sessions_updated_at
BEFORE UPDATE ON public.standalone_sales_process_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_standalone_sp_updated_at();

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE public.agency_feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_sales_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standalone_sales_process_sessions ENABLE ROW LEVEL SECURITY;

-- 3.1 Agency Feature Access - Admin only for write, agency members for read
DROP POLICY IF EXISTS agency_feature_access_admin_all ON public.agency_feature_access;
CREATE POLICY agency_feature_access_admin_all ON public.agency_feature_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS agency_feature_access_select ON public.agency_feature_access;
CREATE POLICY agency_feature_access_select ON public.agency_feature_access
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
    UNION
    SELECT ke.agency_id FROM public.key_employees ke WHERE ke.user_id = auth.uid()
  )
);

-- 3.2 Standalone Sales Process - Agency members can read/write their own
DROP POLICY IF EXISTS standalone_sales_process_select ON public.standalone_sales_process;
CREATE POLICY standalone_sales_process_select ON public.standalone_sales_process
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
    UNION
    SELECT ke.agency_id FROM public.key_employees ke WHERE ke.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS standalone_sales_process_insert ON public.standalone_sales_process;
CREATE POLICY standalone_sales_process_insert ON public.standalone_sales_process
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
    UNION
    SELECT ke.agency_id FROM public.key_employees ke WHERE ke.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS standalone_sales_process_update ON public.standalone_sales_process;
CREATE POLICY standalone_sales_process_update ON public.standalone_sales_process
FOR UPDATE
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
    UNION
    SELECT ke.agency_id FROM public.key_employees ke WHERE ke.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 3.3 Standalone Sales Process Sessions - User can access their own sessions
DROP POLICY IF EXISTS standalone_sp_sessions_select ON public.standalone_sales_process_sessions;
CREATE POLICY standalone_sp_sessions_select ON public.standalone_sales_process_sessions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

DROP POLICY IF EXISTS standalone_sp_sessions_insert ON public.standalone_sales_process_sessions;
CREATE POLICY standalone_sp_sessions_insert ON public.standalone_sales_process_sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS standalone_sp_sessions_update ON public.standalone_sales_process_sessions;
CREATE POLICY standalone_sp_sessions_update ON public.standalone_sales_process_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 4. HELPER FUNCTION
-- =====================================================

-- Check if agency has access to a feature
CREATE OR REPLACE FUNCTION public.has_feature_access(p_agency_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_feature_access
    WHERE agency_id = p_agency_id
    AND feature_key = p_feature_key
  );
$$;
