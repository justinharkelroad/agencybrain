BEGIN;

DO $$
DECLARE
  v_admin_id uuid;
  v_admin_agency_id uuid;
BEGIN
  -- Identify the admin user by email (case-insensitive)
  SELECT u.id INTO v_admin_id
  FROM auth.users u
  WHERE lower(u.email) = lower('justin@hfiagencies.com')
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user with email % not found. Aborting cleanup.', 'justin@hfiagencies.com';
  END IF;

  -- Get admin's agency (if any)
  SELECT p.agency_id INTO v_admin_agency_id
  FROM public.profiles p
  WHERE p.id = v_admin_id;

  -- 1) Delete AI related data for non-admin users (child tables first)
  DELETE FROM public.ai_analysis_views v
  USING public.ai_analysis a
  WHERE v.analysis_id = a.id
    AND (
      (a.user_id IS NOT NULL AND a.user_id <> v_admin_id)
      OR (a.period_id IS NOT NULL AND a.period_id IN (
            SELECT id FROM public.periods WHERE user_id <> v_admin_id
          ))
    );

  DELETE FROM public.ai_analysis_requests r
  USING public.ai_analysis a
  WHERE r.analysis_id = a.id
    AND (
      (a.user_id IS NOT NULL AND a.user_id <> v_admin_id)
      OR (a.period_id IS NOT NULL AND a.period_id IN (
            SELECT id FROM public.periods WHERE user_id <> v_admin_id
          ))
    );

  DELETE FROM public.ai_chat_messages m
  USING public.ai_analysis a
  WHERE m.analysis_id = a.id
    AND (
      (a.user_id IS NOT NULL AND a.user_id <> v_admin_id)
      OR (a.period_id IS NOT NULL AND a.period_id IN (
            SELECT id FROM public.periods WHERE user_id <> v_admin_id
          ))
    );

  -- Remove messages directly tied to non-admin users, if any remain
  DELETE FROM public.ai_chat_messages
  WHERE user_id IS NOT NULL AND user_id <> v_admin_id;

  -- Finally remove the analyses themselves
  DELETE FROM public.ai_analysis
  WHERE (user_id IS NOT NULL AND user_id <> v_admin_id)
     OR (period_id IS NOT NULL AND period_id IN (
          SELECT id FROM public.periods WHERE user_id <> v_admin_id
        ));

  -- 2) Remove user-owned data (periods, uploads, mappings, vaults)
  DELETE FROM public.column_mappings WHERE user_id <> v_admin_id;

  DELETE FROM public.process_vault_files f
  USING public.user_process_vaults v
  WHERE f.user_vault_id = v.id AND v.user_id <> v_admin_id;

  DELETE FROM public.user_process_vaults WHERE user_id <> v_admin_id;

  DELETE FROM public.uploads WHERE user_id <> v_admin_id;

  DELETE FROM public.periods WHERE user_id <> v_admin_id;

  -- 3) Clean agency-scoped data not belonging to admin's agency
  IF v_admin_agency_id IS NOT NULL THEN
    -- Items tied to other agencies
    DELETE FROM public.member_checklist_items mci
    USING public.team_members tm
    WHERE mci.member_id = tm.id AND tm.agency_id <> v_admin_agency_id;

    DELETE FROM public.agency_files WHERE agency_id <> v_admin_agency_id;
    DELETE FROM public.team_members WHERE agency_id <> v_admin_agency_id;
    DELETE FROM public.checklist_template_items WHERE agency_id IS NOT NULL AND agency_id <> v_admin_agency_id;
    DELETE FROM public.agencies WHERE id <> v_admin_agency_id;
  ELSE
    -- If admin has no agency, remove everything agency-scoped
    DELETE FROM public.member_checklist_items;
    DELETE FROM public.agency_files;
    DELETE FROM public.team_members;
    DELETE FROM public.checklist_template_items WHERE agency_id IS NOT NULL;
    DELETE FROM public.agencies;
  END IF;

  -- 4) Remove all non-admin profiles (keep admin profile)
  DELETE FROM public.profiles WHERE id <> v_admin_id;
END $$;

COMMIT;