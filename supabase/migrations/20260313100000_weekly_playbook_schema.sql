-- Weekly Playbook Schema Migration
-- Adds zone-based columns to focus_items and creates agency_playbook_tags table

-- ============================================
-- 1. New columns on focus_items
-- ============================================

-- Zone replaces column_status for new playbook logic
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS zone TEXT NOT NULL DEFAULT 'bench'
    CHECK (zone IN ('bench', 'power_play', 'queue'));

-- Which day a power play is assigned to
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- Core Four domain tag
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS domain TEXT
    CHECK (domain IN ('body', 'being', 'balance', 'business'));

-- Admin-configurable sub-category
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS sub_tag_id UUID;

-- ISO week key for fast queries (e.g. '2026-W11')
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS week_key TEXT;

-- Completion flag (replaces column_status='completed')
ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 2. New table: agency_playbook_tags
-- ============================================

CREATE TABLE IF NOT EXISTS public.agency_playbook_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('body', 'being', 'balance', 'business')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, domain, name)
);

-- FK from focus_items.sub_tag_id → agency_playbook_tags
ALTER TABLE public.focus_items
  ADD CONSTRAINT focus_items_sub_tag_id_fkey
  FOREIGN KEY (sub_tag_id) REFERENCES public.agency_playbook_tags(id) ON DELETE SET NULL;

-- ============================================
-- 3. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_focus_items_zone ON public.focus_items (zone);
CREATE INDEX IF NOT EXISTS idx_focus_items_scheduled_date ON public.focus_items (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_focus_items_domain ON public.focus_items (domain);
CREATE INDEX IF NOT EXISTS idx_focus_items_week_key ON public.focus_items (week_key);
CREATE INDEX IF NOT EXISTS idx_focus_items_user_scheduled ON public.focus_items (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_focus_items_tm_scheduled ON public.focus_items (team_member_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_playbook_tags_agency ON public.agency_playbook_tags (agency_id);
CREATE INDEX IF NOT EXISTS idx_playbook_tags_agency_domain ON public.agency_playbook_tags (agency_id, domain);

-- ============================================
-- 4. RLS for agency_playbook_tags
-- ============================================

ALTER TABLE public.agency_playbook_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone with agency access
CREATE POLICY "agency_playbook_tags_select"
  ON public.agency_playbook_tags FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- INSERT: owner/admin
CREATE POLICY "agency_playbook_tags_insert"
  ON public.agency_playbook_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.agency_id = agency_id)
    )
  );

-- UPDATE: owner/admin
CREATE POLICY "agency_playbook_tags_update"
  ON public.agency_playbook_tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.agency_id = agency_id)
    )
  );

-- DELETE: owner/admin
CREATE POLICY "agency_playbook_tags_delete"
  ON public.agency_playbook_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.agency_id = agency_id)
    )
  );

-- Grant access to anon role (for staff via edge functions with service_role)
GRANT SELECT ON public.agency_playbook_tags TO anon;
GRANT SELECT ON public.agency_playbook_tags TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.agency_playbook_tags TO authenticated;

-- ============================================
-- 5. Trigger: auto-set completed_at when completed changes
-- ============================================

CREATE OR REPLACE FUNCTION public.set_focus_item_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed = true THEN
      NEW.completed_at = NOW();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.completed = true AND (OLD.completed IS DISTINCT FROM true) THEN
      NEW.completed_at = NOW();
    ELSIF NEW.completed = false AND OLD.completed = true THEN
      NEW.completed_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_focus_item_completed_bool_trigger ON public.focus_items;
CREATE TRIGGER set_focus_item_completed_bool_trigger
  BEFORE INSERT OR UPDATE ON public.focus_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_focus_item_completed_at();

-- ============================================
-- 6. RPC: get_power_play_count
-- ============================================

CREATE OR REPLACE FUNCTION public.get_power_play_count(
  p_user_id UUID DEFAULT NULL,
  p_team_member_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.focus_items
  WHERE zone = 'power_play'
    AND scheduled_date = p_date
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_team_member_id IS NOT NULL AND team_member_id = p_team_member_id)
    )
    AND (p_exclude_id IS NULL OR id != p_exclude_id);

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_power_play_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_power_play_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_power_play_count TO anon;
