-- Call Gap Analyzer persistence tables
-- Stores uploaded phone system exports and parsed call records

-- ============================================
-- Table: call_gap_uploads
-- One row per file upload
-- ============================================
CREATE TABLE public.call_gap_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  source_format text NOT NULL CHECK (source_format IN ('ringcentral', 'ricochet')),
  raw_call_count integer NOT NULL DEFAULT 0,
  record_count integer NOT NULL DEFAULT 0,
  date_range_start date,
  date_range_end date,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_by_staff_id uuid REFERENCES public.staff_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT must_have_creator CHECK (
    created_by_user_id IS NOT NULL OR created_by_staff_id IS NOT NULL
  )
);

-- ============================================
-- Table: call_gap_records
-- One row per parsed call (immutable)
-- ============================================
CREATE TABLE public.call_gap_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES public.call_gap_uploads(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  call_start timestamptz NOT NULL,
  call_date date NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================

-- Uploads: agency lookups and ordering
CREATE INDEX idx_call_gap_uploads_agency ON public.call_gap_uploads (agency_id);
CREATE INDEX idx_call_gap_uploads_agency_created ON public.call_gap_uploads (agency_id, created_at DESC);

-- Records: upload lookups, date filtering, dedup
CREATE INDEX idx_call_gap_records_upload ON public.call_gap_records (upload_id);
CREATE INDEX idx_call_gap_records_agency_date ON public.call_gap_records (agency_id, call_date);
CREATE UNIQUE INDEX idx_call_gap_records_dedup ON public.call_gap_records (agency_id, agent_name, call_start, duration_seconds);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.call_gap_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_gap_records ENABLE ROW LEVEL SECURITY;

-- Uploads: SELECT, INSERT, DELETE (no UPDATE needed)
CREATE POLICY "call_gap_uploads_select" ON public.call_gap_uploads
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "call_gap_uploads_insert" ON public.call_gap_uploads
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "call_gap_uploads_delete" ON public.call_gap_uploads
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Records: SELECT, INSERT, DELETE (immutable — no UPDATE)
CREATE POLICY "call_gap_records_select" ON public.call_gap_records
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "call_gap_records_insert" ON public.call_gap_records
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "call_gap_records_delete" ON public.call_gap_records
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- ============================================
-- updated_at trigger (uploads only, records are immutable)
-- ============================================
CREATE TRIGGER update_call_gap_uploads_updated_at
  BEFORE UPDATE ON public.call_gap_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
