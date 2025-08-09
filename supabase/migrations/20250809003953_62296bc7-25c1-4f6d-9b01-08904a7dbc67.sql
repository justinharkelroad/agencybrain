-- Create Process Vault tables and policies

-- 1) Table: process_vault_types (admin-managed defaults)
CREATE TABLE IF NOT EXISTS public.process_vault_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;

-- Policies for process_vault_types
DROP POLICY IF EXISTS "Admins can insert process vault types" ON public.process_vault_types;
CREATE POLICY "Admins can insert process vault types"
ON public.process_vault_types
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can update process vault types" ON public.process_vault_types;
CREATE POLICY "Admins can update process vault types"
ON public.process_vault_types
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can delete process vault types" ON public.process_vault_types;
CREATE POLICY "Admins can delete process vault types"
ON public.process_vault_types
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can view all process vault types" ON public.process_vault_types;
CREATE POLICY "Admins can view all process vault types"
ON public.process_vault_types
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Users can view active process vault types" ON public.process_vault_types;
CREATE POLICY "Users can view active process vault types"
ON public.process_vault_types
FOR SELECT
USING (is_active = true);

-- timestamps trigger
DROP TRIGGER IF EXISTS trg_pvt_update_updated_at ON public.process_vault_types;
CREATE TRIGGER trg_pvt_update_updated_at
BEFORE UPDATE ON public.process_vault_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Ensure uploads.file_path is unique to safely reference it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'unique_uploads_file_path'
  ) THEN
    -- First, ensure no duplicates exist (will raise error if they do)
    CREATE UNIQUE INDEX unique_uploads_file_path ON public.uploads (file_path);
  END IF;
END $$;

-- 3) Table: user_process_vaults (per-user vaults)
CREATE TABLE IF NOT EXISTS public.user_process_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  vault_type_id UUID NULL REFERENCES public.process_vault_types(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_vault_title UNIQUE (user_id, title)
);

ALTER TABLE public.user_process_vaults ENABLE ROW LEVEL SECURITY;

-- Policies for user_process_vaults
DROP POLICY IF EXISTS "Users can manage their own process vaults" ON public.user_process_vaults;
CREATE POLICY "Users can manage their own process vaults"
ON public.user_process_vaults
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all process vaults" ON public.user_process_vaults;
CREATE POLICY "Admins can view all process vaults"
ON public.user_process_vaults
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can modify all process vaults" ON public.user_process_vaults;
CREATE POLICY "Admins can modify all process vaults"
ON public.user_process_vaults
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

CREATE POLICY "Admins can update all process vaults"
ON public.user_process_vaults
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

CREATE POLICY "Admins can delete all process vaults"
ON public.user_process_vaults
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

-- timestamps trigger
DROP TRIGGER IF EXISTS trg_upv_update_updated_at ON public.user_process_vaults;
CREATE TRIGGER trg_upv_update_updated_at
BEFORE UPDATE ON public.user_process_vaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Table: process_vault_files (files linked to a user vault)
CREATE TABLE IF NOT EXISTS public.process_vault_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_vault_id UUID NOT NULL REFERENCES public.user_process_vaults(id) ON DELETE CASCADE,
  upload_file_path TEXT NOT NULL REFERENCES public.uploads(file_path) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vault_file UNIQUE (user_vault_id, upload_file_path)
);

ALTER TABLE public.process_vault_files ENABLE ROW LEVEL SECURITY;

-- Policies for process_vault_files (user owns via parent vault)
DROP POLICY IF EXISTS "Users can view their own vault files" ON public.process_vault_files;
CREATE POLICY "Users can view their own vault files"
ON public.process_vault_files
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_process_vaults v
  WHERE v.id = process_vault_files.user_vault_id AND v.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can insert their own vault files" ON public.process_vault_files;
CREATE POLICY "Users can insert their own vault files"
ON public.process_vault_files
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_process_vaults v
  WHERE v.id = user_vault_id AND v.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can delete their own vault files" ON public.process_vault_files;
CREATE POLICY "Users can delete their own vault files"
ON public.process_vault_files
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.user_process_vaults v
  WHERE v.id = process_vault_files.user_vault_id AND v.user_id = auth.uid()
));

-- Admin policies for process_vault_files
DROP POLICY IF EXISTS "Admins can view all vault files" ON public.process_vault_files;
CREATE POLICY "Admins can view all vault files"
ON public.process_vault_files
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can insert vault files" ON public.process_vault_files;
CREATE POLICY "Admins can insert vault files"
ON public.process_vault_files
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can delete vault files" ON public.process_vault_files;
CREATE POLICY "Admins can delete vault files"
ON public.process_vault_files
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

-- 5) Seed default process vault types
INSERT INTO public.process_vault_types (title)
VALUES
  ('SALES'),
  ('REQUOTES'),
  ('ON BOARDING'),
  ('WINBACKS'),
  ('FOLLOW UP'),
  ('POLICY REVIEW'),
  ('HIRING'),
  ('NEW HIRE'),
  ('CLAIMS'),
  ('CROSS SALE'),
  ('TERMINATION')
ON CONFLICT (title) DO NOTHING;