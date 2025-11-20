-- Phase 1: Period Versions Table
CREATE TABLE IF NOT EXISTS public.period_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  form_data JSONB,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  changed_by UUID REFERENCES auth.users(id),
  change_source TEXT DEFAULT 'user_edit',
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  data_completeness_score INTEGER DEFAULT 0,
  has_meaningful_data BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast version queries
CREATE INDEX idx_period_versions_period_id ON public.period_versions(period_id, valid_from DESC);
CREATE INDEX idx_period_versions_valid ON public.period_versions(period_id, valid_to) WHERE valid_to IS NULL;

-- Helper function to calculate data completeness
CREATE OR REPLACE FUNCTION public.calculate_data_completeness(data JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
  key TEXT;
  val JSONB;
BEGIN
  IF data IS NULL THEN
    RETURN 0;
  END IF;
  
  FOR key, val IN SELECT * FROM jsonb_each(data)
  LOOP
    total_fields := total_fields + 1;
    IF val IS NOT NULL AND val::text != 'null' AND val::text != '""' AND val::text != '[]' AND val::text != '{}' THEN
      filled_fields := filled_fields + 1;
    END IF;
  END LOOP;
  
  IF total_fields = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((filled_fields::NUMERIC / total_fields::NUMERIC) * 100);
END;
$$;

-- Helper function to check if data is meaningful
CREATE OR REPLACE FUNCTION public.check_meaningful_data(data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF data IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if there are any non-empty values
  RETURN EXISTS (
    SELECT 1 FROM jsonb_each(data) 
    WHERE value IS NOT NULL 
    AND value::text != 'null' 
    AND value::text != '""' 
    AND value::text != '[]' 
    AND value::text != '{}'
  );
END;
$$;

-- Trigger to create version on period changes
CREATE OR REPLACE FUNCTION public.create_period_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close previous version
  UPDATE public.period_versions
  SET valid_to = NOW()
  WHERE period_id = NEW.id AND valid_to IS NULL;
  
  -- Create new version
  INSERT INTO public.period_versions (
    period_id,
    form_data,
    title,
    start_date,
    end_date,
    status,
    valid_from,
    changed_by,
    change_source,
    data_completeness_score,
    has_meaningful_data
  ) VALUES (
    NEW.id,
    NEW.form_data,
    NEW.title,
    NEW.start_date,
    NEW.end_date,
    NEW.status,
    NOW(),
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'initial_creation'
      ELSE 'user_edit'
    END,
    calculate_data_completeness(NEW.form_data),
    check_meaningful_data(NEW.form_data)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER period_versioning_trigger
AFTER INSERT OR UPDATE ON public.periods
FOR EACH ROW
EXECUTE FUNCTION public.create_period_version();

-- RLS for period_versions
ALTER TABLE public.period_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own period versions"
ON public.period_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.periods p
    WHERE p.id = period_versions.period_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all period versions"
ON public.period_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Phase 2: Edit Sessions Table
CREATE TABLE IF NOT EXISTS public.period_edit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_fingerprint TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_period_edit_sessions_active ON public.period_edit_sessions(period_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_period_edit_sessions_heartbeat ON public.period_edit_sessions(last_heartbeat) WHERE ended_at IS NULL;

-- RLS for edit sessions
ALTER TABLE public.period_edit_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own edit sessions"
ON public.period_edit_sessions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all edit sessions"
ON public.period_edit_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Phase 3: Period Backups Table
CREATE TABLE IF NOT EXISTS public.period_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  backup_type TEXT NOT NULL DEFAULT 'auto',
  form_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_period_backups_period ON public.period_backups(period_id, created_at DESC);
CREATE INDEX idx_period_backups_user ON public.period_backups(user_id, created_at DESC);

-- RLS for backups
ALTER TABLE public.period_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own period backups"
ON public.period_backups FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all period backups"
ON public.period_backups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Backfill existing periods with initial versions
INSERT INTO public.period_versions (
  period_id,
  form_data,
  title,
  start_date,
  end_date,
  status,
  valid_from,
  changed_by,
  change_source,
  data_completeness_score,
  has_meaningful_data
)
SELECT 
  p.id,
  p.form_data,
  p.title,
  p.start_date,
  p.end_date,
  p.status,
  p.created_at,
  p.user_id,
  'backfill_initial',
  calculate_data_completeness(p.form_data),
  check_meaningful_data(p.form_data)
FROM public.periods p
ON CONFLICT DO NOTHING;