-- 1) Helper: has_agency_access function
CREATE OR REPLACE FUNCTION public.has_agency_access(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = COALESCE(_user_id, auth.uid())
      AND (p.role = 'admin' OR p.agency_id = _agency_id)
  );
$$;

-- 2) Extend agencies table (additive)
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS agent_name text,
  ADD COLUMN IF NOT EXISTS agency_email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS agent_cell text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 3) Enums for member details (idempotent)
DO $$ BEGIN
  CREATE TYPE public.app_member_role AS ENUM ('Sales', 'Service', 'Hybrid', 'Manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_employment_type AS ENUM ('Full-time', 'Part-time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_member_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role public.app_member_role NOT NULL,
  employment public.app_employment_type NOT NULL,
  status public.app_member_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_member_unique_email_per_agency UNIQUE (agency_id, email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- team_members RLS: agency access for all CRUD
DROP POLICY IF EXISTS "Team: agency users manage" ON public.team_members;
CREATE POLICY "Team: agency users manage"
ON public.team_members
FOR ALL
USING (public.has_agency_access(auth.uid(), agency_id))
WITH CHECK (public.has_agency_access(auth.uid(), agency_id));

-- updated_at trigger for team_members
DROP TRIGGER IF EXISTS update_team_members_updated_at ON public.team_members;
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5) checklist_template_items (global or agency specific)
CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique label per scope (global vs per-agency)
CREATE UNIQUE INDEX IF NOT EXISTS checklist_template_items_scope_label_uq
  ON public.checklist_template_items (
    COALESCE(agency_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(label)
  );

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

-- Admin manage all templates
DROP POLICY IF EXISTS "Templates: admins manage all" ON public.checklist_template_items;
CREATE POLICY "Templates: admins manage all"
ON public.checklist_template_items
AS PERMISSIVE
FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Agency users manage their own (no global)
DROP POLICY IF EXISTS "Templates: agency users manage own" ON public.checklist_template_items;
CREATE POLICY "Templates: agency users manage own"
ON public.checklist_template_items
AS PERMISSIVE
FOR ALL
USING (
  agency_id IS NOT NULL AND public.has_agency_access(auth.uid(), agency_id)
)
WITH CHECK (
  agency_id IS NOT NULL AND public.has_agency_access(auth.uid(), agency_id)
);

-- Allow viewing global templates for all authenticated users
DROP POLICY IF EXISTS "Templates: view global" ON public.checklist_template_items;
CREATE POLICY "Templates: view global"
ON public.checklist_template_items
AS PERMISSIVE
FOR SELECT
USING (agency_id IS NULL);

-- updated_at trigger for checklist_template_items
DROP TRIGGER IF EXISTS update_checklist_template_items_updated_at ON public.checklist_template_items;
CREATE TRIGGER update_checklist_template_items_updated_at
BEFORE UPDATE ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6) member_checklist_items
CREATE TABLE IF NOT EXISTS public.member_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE RESTRICT,
  secured boolean NOT NULL DEFAULT false,
  attachments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_checklist_unique UNIQUE (member_id, template_item_id)
);

ALTER TABLE public.member_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS: any access requires membership in same agency
DROP POLICY IF EXISTS "MCI: agency users manage" ON public.member_checklist_items;
CREATE POLICY "MCI: agency users manage"
ON public.member_checklist_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = member_id AND public.has_agency_access(auth.uid(), tm.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = member_id AND public.has_agency_access(auth.uid(), tm.agency_id)
  )
);

-- updated_at trigger for member_checklist_items
DROP TRIGGER IF EXISTS update_member_checklist_items_updated_at ON public.member_checklist_items;
CREATE TRIGGER update_member_checklist_items_updated_at
BEFORE UPDATE ON public.member_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7) agency_files: metadata for uploads (maps to storage path)
CREATE TABLE IF NOT EXISTS public.agency_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  member_id uuid NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  template_item_id uuid NULL REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text,
  size integer,
  visibility text NOT NULL DEFAULT 'owner_admin',
  uploaded_by_user_id uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_files_member_template_pair CHECK (
    (member_id IS NULL AND template_item_id IS NULL) OR (member_id IS NOT NULL AND template_item_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_agency_files_agency ON public.agency_files(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_files_member ON public.agency_files(member_id);
CREATE INDEX IF NOT EXISTS idx_agency_files_template ON public.agency_files(template_item_id);

ALTER TABLE public.agency_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency files: agency users manage" ON public.agency_files;
CREATE POLICY "Agency files: agency users manage"
ON public.agency_files
FOR ALL
USING (public.has_agency_access(auth.uid(), agency_id))
WITH CHECK (public.has_agency_access(auth.uid(), agency_id));

-- updated_at trigger for agency_files
DROP TRIGGER IF EXISTS update_agency_files_updated_at ON public.agency_files;
CREATE TRIGGER update_agency_files_updated_at
BEFORE UPDATE ON public.agency_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Validate agency_files rows and set defaults
CREATE OR REPLACE FUNCTION public.validate_agency_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_agency uuid;
BEGIN
  -- enforce size <= 25MB when provided
  IF NEW.size IS NOT NULL AND NEW.size > 26214400 THEN
    RAISE EXCEPTION 'File exceeds maximum size of 25MB';
  END IF;

  -- uploaded_by_user_id must match current user unless admin
  IF NEW.uploaded_by_user_id IS NULL THEN
    NEW.uploaded_by_user_id = auth.uid();
  ELSIF NEW.uploaded_by_user_id <> auth.uid() THEN
    -- allow admins to set another uploader id
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') THEN
      RAISE EXCEPTION 'uploaded_by_user_id mismatch';
    END IF;
  END IF;

  -- If member-bound file, ensure agency consistency
  IF NEW.member_id IS NOT NULL THEN
    SELECT tm.agency_id INTO member_agency FROM public.team_members tm WHERE tm.id = NEW.member_id;
    IF member_agency IS NULL THEN
      RAISE EXCEPTION 'Invalid member reference';
    END IF;
    IF member_agency <> NEW.agency_id THEN
      RAISE EXCEPTION 'Member and file agency mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_agency_file_trg ON public.agency_files;
CREATE TRIGGER validate_agency_file_trg
BEFORE INSERT OR UPDATE ON public.agency_files
FOR EACH ROW
EXECUTE FUNCTION public.validate_agency_file();

-- 8) Auto-init member checklist items upon team member creation
CREATE OR REPLACE FUNCTION public.init_member_checklist_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert active templates (global + agency-specific) for the new member
  INSERT INTO public.member_checklist_items (member_id, template_item_id)
  SELECT NEW.id, cti.id
  FROM public.checklist_template_items cti
  WHERE cti.active = true AND (cti.agency_id IS NULL OR cti.agency_id = NEW.agency_id)
  ON CONFLICT (member_id, template_item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS init_member_checklist_items_trg ON public.team_members;
CREATE TRIGGER init_member_checklist_items_trg
AFTER INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.init_member_checklist_items();

-- 9) When a new template (agency-specific) is created or activated, apply to all members in that agency
CREATE OR REPLACE FUNCTION public.apply_new_agency_template_to_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.agency_id IS NOT NULL AND NEW.active = true)
     OR (TG_OP = 'UPDATE' AND NEW.agency_id IS NOT NULL AND NEW.active = true AND COALESCE(OLD.active,false) = false) THEN
    INSERT INTO public.member_checklist_items (member_id, template_item_id)
    SELECT tm.id, NEW.id
    FROM public.team_members tm
    WHERE tm.agency_id = NEW.agency_id
    ON CONFLICT (member_id, template_item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_new_template_trg ON public.checklist_template_items;
CREATE TRIGGER apply_new_template_trg
AFTER INSERT OR UPDATE ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.apply_new_agency_template_to_members();

-- 10) Sync secured/attachments_count on agency_files changes
CREATE OR REPLACE FUNCTION public.sync_mci_secured_on_file_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_template_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_member_id := NEW.member_id;
    v_template_id := NEW.template_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_member_id := OLD.member_id;
    v_template_id := OLD.template_item_id;
  ELSE
    -- UPDATE: handle moved attachment between items/members
    v_member_id := COALESCE(NEW.member_id, OLD.member_id);
    v_template_id := COALESCE(NEW.template_item_id, OLD.template_item_id);
  END IF;

  IF v_member_id IS NOT NULL AND v_template_id IS NOT NULL THEN
    UPDATE public.member_checklist_items mci
    SET attachments_count = sub.cnt,
        secured = sub.cnt > 0,
        updated_at = now()
    FROM (
      SELECT COUNT(*)::int AS cnt
      FROM public.agency_files af
      WHERE af.member_id = v_member_id AND af.template_item_id = v_template_id
    ) sub
    WHERE mci.member_id = v_member_id AND mci.template_item_id = v_template_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_mci_on_file_change ON public.agency_files;
CREATE TRIGGER sync_mci_on_file_change
AFTER INSERT OR UPDATE OR DELETE ON public.agency_files
FOR EACH ROW
EXECUTE FUNCTION public.sync_mci_secured_on_file_change();

-- 11) Seed global default checklist items (idempotent)
INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Agency Handbook', true, 10, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Agency Handbook')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'W-4', true, 20, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('W-4')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Accountability Policy', true, 30, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Accountability Policy')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Daily Metrics', true, 40, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Daily Metrics')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Consequence Policy', true, 50, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Consequence Policy')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'New Hire Document', true, 60, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('New Hire Document')
);
