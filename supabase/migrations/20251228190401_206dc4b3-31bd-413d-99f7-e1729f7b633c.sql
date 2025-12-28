-- =====================================================
-- PHASE 1: Compensation Analyzer Database Setup
-- =====================================================

-- 1. Create storage bucket for compensation statements
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compensation-statements',
  'compensation-statements',
  false,
  52428800, -- 50MB
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
);

-- Storage RLS Policies (4 policies)
CREATE POLICY "Users can view own agency compensation files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'compensation-statements' 
  AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can upload to own agency folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'compensation-statements' 
  AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can update own agency files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'compensation-statements' 
  AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can delete own agency files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'compensation-statements' 
  AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- =====================================================
-- 2. Create agency_comp_settings table
-- =====================================================
CREATE TABLE public.agency_comp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE UNIQUE NOT NULL,
  state VARCHAR(2) NOT NULL DEFAULT 'TX',
  aap_level VARCHAR(20) NOT NULL DEFAULT 'Pro' CHECK (aap_level IN ('Elite', 'Pro', 'Emerging')),
  agency_tier VARCHAR(10) DEFAULT NULL CHECK (agency_tier IS NULL OR agency_tier IN ('1', '2', '3', '4', '4B')),
  pif_count INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agency_comp_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_comp_settings (4 policies)
CREATE POLICY "Users can view own agency settings"
ON public.agency_comp_settings FOR SELECT
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert own agency settings"
ON public.agency_comp_settings FOR INSERT
WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update own agency settings"
ON public.agency_comp_settings FOR UPDATE
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete own agency settings"
ON public.agency_comp_settings FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- Trigger for updated_at
CREATE TRIGGER update_agency_comp_settings_updated_at
  BEFORE UPDATE ON public.agency_comp_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. Create comp_statement_uploads table
-- =====================================================
CREATE TABLE public.comp_statement_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  statement_month INTEGER NOT NULL CHECK (statement_month >= 1 AND statement_month <= 12),
  statement_year INTEGER NOT NULL CHECK (statement_year >= 2020),
  filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  vc_baseline_achieved BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, statement_month, statement_year)
);

-- Enable RLS
ALTER TABLE public.comp_statement_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comp_statement_uploads (4 policies)
CREATE POLICY "Users can view own agency uploads"
ON public.comp_statement_uploads FOR SELECT
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert own agency uploads"
ON public.comp_statement_uploads FOR INSERT
WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update own agency uploads"
ON public.comp_statement_uploads FOR UPDATE
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete own agency uploads"
ON public.comp_statement_uploads FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- =====================================================
-- 4. Create comp_comparison_reports table
-- =====================================================
CREATE TABLE public.comp_comparison_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  prior_upload_id UUID REFERENCES public.comp_statement_uploads(id) ON DELETE CASCADE NOT NULL,
  current_upload_id UUID REFERENCES public.comp_statement_uploads(id) ON DELETE CASCADE NOT NULL,
  comparison_data JSONB NOT NULL,
  summary_data JSONB NOT NULL,
  discrepancies_found INTEGER DEFAULT 0,
  potential_underpayment_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.comp_comparison_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comp_comparison_reports (4 policies)
CREATE POLICY "Users can view own agency reports"
ON public.comp_comparison_reports FOR SELECT
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert own agency reports"
ON public.comp_comparison_reports FOR INSERT
WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update own agency reports"
ON public.comp_comparison_reports FOR UPDATE
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete own agency reports"
ON public.comp_comparison_reports FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));