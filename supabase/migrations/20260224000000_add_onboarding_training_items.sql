-- Onboarding Training Checklist: simple per-member training items
-- (no templates, no file uploads — just add/check/note/remove)

CREATE TABLE public.onboarding_training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  label text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by_user_id uuid REFERENCES auth.users(id),
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_onboarding_training_items_member ON public.onboarding_training_items(member_id);
CREATE INDEX idx_onboarding_training_items_agency ON public.onboarding_training_items(agency_id);

-- updated_at trigger (reuse existing function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.onboarding_training_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.onboarding_training_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_onboarding_training_items"
  ON public.onboarding_training_items FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "insert_onboarding_training_items"
  ON public.onboarding_training_items FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "update_onboarding_training_items"
  ON public.onboarding_training_items FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "delete_onboarding_training_items"
  ON public.onboarding_training_items FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_training_items TO authenticated;
GRANT ALL ON public.onboarding_training_items TO service_role;

-- Realtime (required for postgres_changes subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_training_items;
