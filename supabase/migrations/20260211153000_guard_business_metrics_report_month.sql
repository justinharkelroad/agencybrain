-- Guard against malformed month-year values (e.g., year 0205)
-- and enforce month-level dates only.

-- Clean up invalid snapshot rows first (defensive)
DELETE FROM public.business_metrics_snapshots
WHERE report_month < DATE '2000-01-01'
   OR report_month > DATE '2100-12-31'
   OR date_trunc('month', report_month)::date <> report_month;

-- Clean up invalid report rows (cascades to snapshots via FK)
DELETE FROM public.business_metrics_reports
WHERE report_month < DATE '2000-01-01'
   OR report_month > DATE '2100-12-31'
   OR date_trunc('month', report_month)::date <> report_month;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_metrics_reports_report_month_valid_chk'
  ) THEN
    ALTER TABLE public.business_metrics_reports
      ADD CONSTRAINT business_metrics_reports_report_month_valid_chk
      CHECK (
        report_month >= DATE '2000-01-01'
        AND report_month <= DATE '2100-12-31'
        AND date_trunc('month', report_month)::date = report_month
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_metrics_snapshots_report_month_valid_chk'
  ) THEN
    ALTER TABLE public.business_metrics_snapshots
      ADD CONSTRAINT business_metrics_snapshots_report_month_valid_chk
      CHECK (
        report_month >= DATE '2000-01-01'
        AND report_month <= DATE '2100-12-31'
        AND date_trunc('month', report_month)::date = report_month
      );
  END IF;
END
$$;
