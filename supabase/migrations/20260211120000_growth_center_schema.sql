-- Growth Center core schema
-- Derived from GROWTH_INTELLIGENCE_CENTER_PLAN_CLAUDE_CODE.md Appendix A

-- ============================================================
-- CARRIER SCHEMA REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.carrier_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_name TEXT NOT NULL,
  schema_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  field_map JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.carrier_schemas (carrier_name, schema_key, display_name, field_map)
VALUES (
  'Allstate',
  'allstate_bm',
  'Allstate Business Metrics Report',
  '{
    "sheet_index": 0,
    "sheet_name": "Business Metrics Printable View",
    "agent_cell": "B4",
    "production_date_cell": "B3",
    "sections": {
      "capped_items": {
        "fields": {
          "new": 10,
          "renewal": 11,
          "total": 12,
          "pye": 13,
          "variance_to_pye": 14
        }
      },
      "policies_in_force": {
        "fields": {
          "current": 16,
          "pye": 17,
          "variance_to_pye": 18
        }
      },
      "retention": {
        "fields": {
          "current_month": 20,
          "prior_year": 21,
          "point_variance_py": 22,
          "net_retention": 23
        }
      },
      "tenure_retention": {
        "fields": {
          "0_2_years": 25,
          "2_plus_years": 26,
          "2_5_years": 27,
          "5_plus_years": 28
        }
      },
      "written_premium": {
        "fields": {
          "current_month_new": 30,
          "current_month_renewal": 31,
          "current_month_total": 32,
          "py_same_month": 33,
          "pct_variance_py": 34,
          "ytd_new": 35,
          "ytd_renewal": 36,
          "ytd_total": 37,
          "prior_year_ytd": 38,
          "pct_variance_py_ytd": 39,
          "written_premium_12mm": 40,
          "earned_premium_12mm": 41
        }
      },
      "loss_ratio": {
        "fields": {
          "adj_earned_premium_12mm": 43,
          "adj_paid_losses_12mm": 44,
          "adj_paid_loss_ratio_12mm": 45,
          "adj_earned_premium_24mm": 46,
          "adj_paid_losses_24mm": 47,
          "adj_paid_loss_ratio_24mm": 48
        }
      }
    },
    "columns": {
      "standard_auto": "B",
      "non_standard_auto": "C",
      "specialty_auto": "D",
      "homeowners": "E",
      "renters": "F",
      "condo": "G",
      "other_special_property": "H",
      "total_personal_lines": "I",
      "abi_voluntary_auto": "J",
      "abi_non_auto": "K",
      "total_pc": "L"
    },
    "sheet2": {
      "sheet_name": "BM Printable View",
      "columns": {
        "flood": "B",
        "motor_club": "C",
        "north_light": "D",
        "ivantage": "E"
      },
      "fields": {
        "capped_items_current": 8,
        "capped_items_pye": 9,
        "capped_items_variance": 10,
        "pif_current": 11,
        "pif_pye": 12,
        "pif_variance": 13,
        "retention_current": 14,
        "written_premium_current": 15,
        "written_premium_ytd": 16,
        "loss_ratio_12mm": 17,
        "loss_ratio_24mm": 18
      }
    }
  }'::jsonb
)
ON CONFLICT (schema_key) DO UPDATE
SET
  carrier_name = EXCLUDED.carrier_name,
  display_name = EXCLUDED.display_name,
  field_map = EXCLUDED.field_map,
  is_active = true,
  updated_at = now();

-- Alias key for easier CLI smoke testing and backward compatibility
INSERT INTO public.carrier_schemas (carrier_name, schema_key, display_name, field_map)
SELECT carrier_name, 'allstate', display_name || ' (Alias)', field_map
FROM public.carrier_schemas
WHERE schema_key = 'allstate_bm'
ON CONFLICT (schema_key) DO NOTHING;

-- ============================================================
-- BUSINESS METRICS REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_metrics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  carrier_schema_id UUID NOT NULL REFERENCES public.carrier_schemas(id),
  report_month DATE NOT NULL,
  agent_code TEXT,
  agent_name TEXT,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  parsed_data JSONB,
  bonus_projection_cents BIGINT,
  is_baseline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agency_id, carrier_schema_id, report_month)
);

-- ============================================================
-- BUSINESS METRICS SNAPSHOTS (flattened for fast trend queries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.business_metrics_reports(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,

  -- Growth
  capped_items_total INTEGER,
  capped_items_new INTEGER,
  capped_items_renewal INTEGER,
  capped_items_pye INTEGER,
  capped_items_variance_pye INTEGER,

  -- Policies in Force
  pif_current INTEGER,
  pif_pye INTEGER,
  pif_variance_pye INTEGER,

  -- Retention (Total P&C)
  retention_current DECIMAL(6,4),
  retention_prior_year DECIMAL(6,4),
  retention_point_variance_py DECIMAL(6,4),
  net_retention DECIMAL(6,4),

  -- Retention by Tenure
  retention_0_2_years DECIMAL(6,4),
  retention_2_plus_years DECIMAL(6,4),
  retention_2_5_years DECIMAL(6,4),
  retention_5_plus_years DECIMAL(6,4),

  -- Retention by Line
  retention_std_auto DECIMAL(6,4),
  retention_homeowners DECIMAL(6,4),
  retention_renters DECIMAL(6,4),
  retention_condo DECIMAL(6,4),
  retention_other_special DECIMAL(6,4),

  -- Written Premium (cents)
  premium_current_month_new BIGINT,
  premium_current_month_renewal BIGINT,
  premium_current_month_total BIGINT,
  premium_py_same_month BIGINT,
  premium_pct_variance_py DECIMAL(6,4),
  premium_ytd_total BIGINT,
  premium_prior_year_ytd BIGINT,
  premium_pct_variance_py_ytd DECIMAL(6,4),
  premium_12mm_written BIGINT,
  premium_12mm_earned BIGINT,

  -- Loss Ratio
  loss_ratio_12mm DECIMAL(6,4),
  loss_ratio_24mm DECIMAL(6,4),
  adj_paid_losses_12mm BIGINT,
  adj_earned_premium_12mm BIGINT,

  -- Standard Auto specifics
  std_auto_new_items INTEGER,
  std_auto_retention DECIMAL(6,4),
  std_auto_retention_py_var DECIMAL(6,4),

  -- Homeowners specifics
  ho_retention DECIMAL(6,4),
  ho_retention_py_var DECIMAL(6,4),
  ho_premium_current BIGINT,

  -- Motor Club (Sheet 2)
  motor_club_items_current INTEGER,
  motor_club_items_pye INTEGER,
  motor_club_items_variance INTEGER,
  motor_club_retention DECIMAL(6,4),

  -- Bonus
  bonus_projection_cents BIGINT,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (report_id)
);

-- ============================================================
-- AI ANALYSIS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gic_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  report_ids UUID[] NOT NULL,
  analysis_type TEXT NOT NULL,
  analysis_result TEXT NOT NULL,
  model_used TEXT NOT NULL,
  included_lqs_data BOOLEAN DEFAULT false,
  included_scorecard_data BOOLEAN DEFAULT false,
  conversation JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-metrics', 'business-metrics', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.carrier_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gic_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read carrier schemas" ON public.carrier_schemas;
CREATE POLICY "Anyone can read carrier schemas"
ON public.carrier_schemas
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can view their agency reports" ON public.business_metrics_reports;
CREATE POLICY "Users can view their agency reports"
ON public.business_metrics_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_reports.agency_id
  )
);

DROP POLICY IF EXISTS "Users can insert their agency reports" ON public.business_metrics_reports;
CREATE POLICY "Users can insert their agency reports"
ON public.business_metrics_reports
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_reports.agency_id
  )
);

DROP POLICY IF EXISTS "Users can update their agency reports" ON public.business_metrics_reports;
CREATE POLICY "Users can update their agency reports"
ON public.business_metrics_reports
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_reports.agency_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_reports.agency_id
  )
);

DROP POLICY IF EXISTS "Users can delete their agency reports" ON public.business_metrics_reports;
CREATE POLICY "Users can delete their agency reports"
ON public.business_metrics_reports
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_reports.agency_id
  )
);

DROP POLICY IF EXISTS "Users can view their agency snapshots" ON public.business_metrics_snapshots;
CREATE POLICY "Users can view their agency snapshots"
ON public.business_metrics_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = business_metrics_snapshots.agency_id
  )
);

DROP POLICY IF EXISTS "Users can view their agency analyses" ON public.gic_analyses;
CREATE POLICY "Users can view their agency analyses"
ON public.gic_analyses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = gic_analyses.agency_id
  )
);

DROP POLICY IF EXISTS "Users can insert their agency analyses" ON public.gic_analyses;
CREATE POLICY "Users can insert their agency analyses"
ON public.gic_analyses
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id = gic_analyses.agency_id
  )
);

-- Storage policies scoped by agency folder prefix:
-- object path format: <agency_id>/<report_month>/<filename>.xlsx
DROP POLICY IF EXISTS "Users can read business metrics files for their agency" ON storage.objects;
CREATE POLICY "Users can read business metrics files for their agency"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'business-metrics'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Users can upload business metrics files for their agency" ON storage.objects;
CREATE POLICY "Users can upload business metrics files for their agency"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'business-metrics'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Users can update business metrics files for their agency" ON storage.objects;
CREATE POLICY "Users can update business metrics files for their agency"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'business-metrics'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'business-metrics'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Users can delete business metrics files for their agency" ON storage.objects;
CREATE POLICY "Users can delete business metrics files for their agency"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'business-metrics'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.agency_id::text = (storage.foldername(name))[1]
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bm_reports_agency_month
  ON public.business_metrics_reports(agency_id, report_month);
CREATE INDEX IF NOT EXISTS idx_bm_snapshots_agency_month
  ON public.business_metrics_snapshots(agency_id, report_month);
CREATE INDEX IF NOT EXISTS idx_gic_analyses_agency
  ON public.gic_analyses(agency_id, created_at DESC);
