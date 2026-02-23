
-- 1) Ensure new signups always create a brand-new agency, never reuse by name
--    Drop any unique constraint or unique index on agencies.name if present

-- Common implicit unique constraint name
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_name_key;
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS unique_agency_name;

-- Remove any other unique constraints whose definition includes the name column.
DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid
      AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'agencies'
      AND c.contype = 'u'
      AND a.attname = 'name'
  LOOP
    EXECUTE format('ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

-- Drop any unique index on agencies(name) that might prevent duplicates
DO $$
DECLARE
  idx text;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'agencies'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%(name)%'
      AND indexname NOT IN (
        SELECT c2.conname
        FROM pg_constraint c2
        JOIN pg_class t2 ON t2.oid = c2.conrelid
        JOIN pg_namespace n2 ON n2.oid = t2.relnamespace
        JOIN pg_class i2 ON i2.oid = c2.conindid
        WHERE n2.nspname = 'public'
          AND t2.relname = 'agencies'
          AND c2.contype IN ('p', 'u')
          AND i2.relname IS NOT NULL
          AND i2.relname = indexname
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx);
  END LOOP;
END $$;

-- 2) Replace the new-user trigger function to always insert a fresh agency row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_agency_id uuid;
  v_agency_name text;
BEGIN
  -- Read agency name from user metadata
  v_agency_name := NEW.raw_user_meta_data ->> 'agency_name';

  IF v_agency_name IS NOT NULL AND length(trim(v_agency_name)) > 0 THEN
    -- Always create a brand-new agency record (even if name already exists)
    INSERT INTO public.agencies (name)
    VALUES (v_agency_name)
    RETURNING id INTO v_agency_id;
  END IF;

  -- Create the profile if not already present, associate with the new agency id
  INSERT INTO public.profiles (id, agency_id, role)
  VALUES (
    NEW.id,
    v_agency_id,
    CASE WHEN NEW.email = 'admin@example.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3) PURGE: wipe all existing agency-scoped data for a clean beta environment

-- 3a) Clear storage metadata for the uploads bucket (objects). This removes DB rows for files.
--     Note: Actual object bytes are also removed when DB rows are deleted.
DO $$
BEGIN
  DELETE FROM storage.objects WHERE bucket_id = 'uploads';
EXCEPTION
  WHEN insufficient_privilege OR others THEN
    RAISE NOTICE 'Skipping storage.objects purge due environment restrictions: %', SQLERRM;
END $$;

-- 3b) Delete rows from dependent tables in a safe order

-- AI and analysis-related tables
DELETE FROM public.ai_analysis_views;
DELETE FROM public.ai_chat_messages;
DELETE FROM public.ai_analysis_requests;
DELETE FROM public.ai_analysis;

-- Client/user data
DELETE FROM public.periods;
DELETE FROM public.uploads;

-- Process vault data
DELETE FROM public.process_vault_files;
DELETE FROM public.user_process_vaults;

-- Agency onboarding/checklist data
DELETE FROM public.agency_files;
DELETE FROM public.member_checklist_items;
DELETE FROM public.team_members;

-- Remove agency-specific checklist templates but keep global templates (agency_id IS NULL)
DELETE FROM public.checklist_template_items WHERE agency_id IS NOT NULL;

-- Detach profiles from any agencies
UPDATE public.profiles SET agency_id = NULL;

-- Finally, delete all agencies
DELETE FROM public.agencies;
