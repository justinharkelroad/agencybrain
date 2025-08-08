
-- 1) Add user_id to ai_analysis and backfill from periods
ALTER TABLE public.ai_analysis
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS ai_analysis_user_id_idx ON public.ai_analysis(user_id);
CREATE INDEX IF NOT EXISTS ai_analysis_shared_idx ON public.ai_analysis(shared_with_client);

UPDATE public.ai_analysis a
SET user_id = p.user_id
FROM public.periods p
WHERE a.period_id = p.id
  AND a.user_id IS NULL;

-- Ensure updated_at gets stamped on updates (uses existing function)
DROP TRIGGER IF EXISTS trg_update_ai_analysis_updated_at ON public.ai_analysis;
CREATE TRIGGER trg_update_ai_analysis_updated_at
BEFORE UPDATE ON public.ai_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RLS policy updates on ai_analysis:
-- Drop the existing client-readable policy so clients only see shared items going forward
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.ai_analysis;

-- Allow clients to read only analyses explicitly shared with them, either via user_id OR via period ownership
CREATE POLICY "Clients can view shared analyses"
ON public.ai_analysis
FOR SELECT
USING (
  shared_with_client = true
  AND (
    user_id = auth.uid()
    OR (
      period_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.periods
        WHERE periods.id = ai_analysis.period_id
          AND periods.user_id = auth.uid()
      )
    )
  )
);

-- Ensure admins can update and delete analyses from the UI
CREATE POLICY "Admins can update any analysis"
ON public.ai_analysis
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete any analysis"
ON public.ai_analysis
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 3) Create ai_analysis_views to track views and acknowledgements
CREATE TABLE IF NOT EXISTS public.ai_analysis_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.ai_analysis(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, user_id)
);

ALTER TABLE public.ai_analysis_views ENABLE ROW LEVEL SECURITY;

-- Client policies: can create/select/update only their own records
CREATE POLICY "Clients can create their own analysis views"
ON public.ai_analysis_views
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can view their own analysis views"
ON public.ai_analysis_views
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Clients can update their own analysis views"
ON public.ai_analysis_views
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin policies: can view/update all for reporting/admin UI
CREATE POLICY "Admins can view all analysis views"
ON public.ai_analysis_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update all analysis views"
ON public.ai_analysis_views
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Indexes and trigger
CREATE INDEX IF NOT EXISTS ai_analysis_views_user_ack_idx ON public.ai_analysis_views(user_id, acknowledged);
CREATE INDEX IF NOT EXISTS ai_analysis_views_analysis_idx ON public.ai_analysis_views(analysis_id);

DROP TRIGGER IF EXISTS trg_update_ai_analysis_views_updated_at ON public.ai_analysis_views;
CREATE TRIGGER trg_update_ai_analysis_views_updated_at
BEFORE UPDATE ON public.ai_analysis_views
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Create ai_analysis_requests for client "deeper dive" requests
CREATE TABLE IF NOT EXISTS public.ai_analysis_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.ai_analysis(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_analysis_requests ENABLE ROW LEVEL SECURITY;

-- Client policies: create/view their own requests
CREATE POLICY "Clients can create their own analysis requests"
ON public.ai_analysis_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can view their own analysis requests"
ON public.ai_analysis_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admin policies: view/update all requests
CREATE POLICY "Admins can view all analysis requests"
ON public.ai_analysis_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update all analysis requests"
ON public.ai_analysis_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Optional admin delete policy (cleanup if needed)
CREATE POLICY "Admins can delete analysis requests"
ON public.ai_analysis_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Indexes and trigger
CREATE INDEX IF NOT EXISTS ai_analysis_requests_analysis_idx ON public.ai_analysis_requests(analysis_id);
CREATE INDEX IF NOT EXISTS ai_analysis_requests_status_idx ON public.ai_analysis_requests(status);

DROP TRIGGER IF EXISTS trg_update_ai_analysis_requests_updated_at ON public.ai_analysis_requests;
CREATE TRIGGER trg_update_ai_analysis_requests_updated_at
BEFORE UPDATE ON public.ai_analysis_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
