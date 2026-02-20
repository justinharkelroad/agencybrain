-- Dropped Record Lifecycle Tracking for Renewals
-- When a new report is uploaded for a date range, existing active records in that range
-- are marked "dropped" first. Records that reappear in the new upload are reactivated.

-- 1. Add dropped_from_report_at column
ALTER TABLE public.renewal_records
  ADD COLUMN IF NOT EXISTS dropped_from_report_at TIMESTAMPTZ;

-- Index for efficient lookup of dropped records per agency
CREATE INDEX IF NOT EXISTS idx_renewal_records_dropped
  ON public.renewal_records (agency_id)
  WHERE dropped_from_report_at IS NOT NULL;

-- 2. New Allstate report columns the parser currently drops
ALTER TABLE public.renewal_records
  ADD COLUMN IF NOT EXISTS carrier_status TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Update get_renewal_stats to include droppedUnresolved count
CREATE OR REPLACE FUNCTION public.get_renewal_stats(
  p_agency_id UUID,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'uncontacted', COUNT(*) FILTER (WHERE current_status = 'uncontacted'),
    'pending', COUNT(*) FILTER (WHERE current_status = 'pending'),
    'success', COUNT(*) FILTER (WHERE current_status = 'success'),
    'unsuccessful', COUNT(*) FILTER (WHERE current_status = 'unsuccessful'),
    'bundled', COUNT(*) FILTER (WHERE multi_line_indicator = 'yes'),
    'monoline', COUNT(*) FILTER (WHERE multi_line_indicator = 'no'),
    'unknown', COUNT(*) FILTER (WHERE multi_line_indicator NOT IN ('yes','no') OR multi_line_indicator IS NULL),
    'droppedUnresolved', (
      SELECT COUNT(*)
      FROM public.renewal_records dr
      WHERE dr.agency_id = p_agency_id
        AND dr.is_active = false
        AND dr.dropped_from_report_at IS NOT NULL
        AND dr.current_status IN ('uncontacted', 'pending')
        AND (p_date_start IS NULL OR dr.renewal_effective_date >= p_date_start)
        AND (p_date_end IS NULL OR dr.renewal_effective_date <= p_date_end)
    ),
    'productNames', (
      SELECT COALESCE(json_agg(DISTINCT sub.product_name ORDER BY sub.product_name), '[]'::json)
      FROM public.renewal_records sub
      WHERE sub.agency_id = p_agency_id
        AND sub.is_active = true
        AND sub.product_name IS NOT NULL
        AND (p_date_start IS NULL OR sub.renewal_effective_date >= p_date_start)
        AND (p_date_end IS NULL OR sub.renewal_effective_date <= p_date_end)
    )
  )
  FROM public.renewal_records
  WHERE agency_id = p_agency_id
    AND is_active = true
    AND (p_date_start IS NULL OR renewal_effective_date >= p_date_start)
    AND (p_date_end IS NULL OR renewal_effective_date <= p_date_end);
$$;

-- Preserve auth chain from original migration (20260217200000)
REVOKE EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) TO anon;
