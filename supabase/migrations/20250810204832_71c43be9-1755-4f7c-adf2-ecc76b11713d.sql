
-- 1) Ensure a unique index exists for ON CONFLICT safety (harmless if already present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_checklist_unique
ON public.member_checklist_items(member_id, template_item_id);

-- 2) Triggers to auto-apply templates to members, initialize new members, and sync secured status

-- 2a) init_member_checklist_items: when a new team member is created, seed active templates (global + agency)
CREATE OR REPLACE FUNCTION public.init_member_checklist_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- 2b) apply_new_agency_template_to_members: when a template (with agency_id) is created or activated, seed it to all existing members in that agency
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

-- 2c) sync_mci_secured_on_file_change: keep secured/attachments_count in sync with agency_files
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

-- 3) One-time backfill: apply all active templates (global + agency-specific) to all existing members
INSERT INTO public.member_checklist_items (member_id, template_item_id)
SELECT tm.id AS member_id, cti.id AS template_item_id
FROM public.team_members tm
JOIN public.checklist_template_items cti
  ON cti.active = true
 AND (cti.agency_id IS NULL OR cti.agency_id = tm.agency_id)
LEFT JOIN public.member_checklist_items mci
  ON mci.member_id = tm.id
 AND mci.template_item_id = cti.id
WHERE mci.id IS NULL
ON CONFLICT (member_id, template_item_id) DO NOTHING;
