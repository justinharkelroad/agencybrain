-- Fix: renewal stats capped at 1,000 rows due to PostgREST default limit.
-- Both the edge function (staff path) and direct queries (owner path) were
-- fetching all rows then counting in JS — silently capped at 1,000.
-- This RPC counts server-side with SQL aggregates, no row limit.

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

-- Auth: callable by authenticated users (owner/admin via has_agency_access)
-- and anon (staff edge functions via service role).
REVOKE EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_stats(UUID, DATE, DATE) TO anon;
