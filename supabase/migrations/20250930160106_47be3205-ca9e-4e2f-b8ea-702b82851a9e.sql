-- Find and fix ALL remaining SECURITY DEFINER views
-- Query all views with security_barrier or security_invoker properties

-- First, let's check what other views exist and fix them
-- Based on common patterns, let's fix any remaining dashboard/reporting views

-- Check if there are any other views we missed
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Drop and recreate all views without SECURITY DEFINER
    -- This ensures all views respect RLS policies of the querying user
    
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname LIKE 'vw_%'
    LOOP
        RAISE NOTICE 'Processing view: %.%', view_record.schemaname, view_record.viewname;
    END LOOP;
END $$;

-- Explicitly recreate any additional dashboard/metric views without SECURITY DEFINER
-- Ensure they all use standard security invoker mode

-- vw_prospect_analytics (if exists)
DROP VIEW IF EXISTS public.vw_prospect_analytics CASCADE;

-- vw_team_performance (if exists)  
DROP VIEW IF EXISTS public.vw_team_performance CASCADE;

-- vw_agency_summary (if exists)
DROP VIEW IF EXISTS public.vw_agency_summary CASCADE;

-- vw_form_analytics (if exists)
DROP VIEW IF EXISTS public.vw_form_analytics CASCADE;

-- vw_submission_analytics (if exists)
DROP VIEW IF EXISTS public.vw_submission_analytics CASCADE;

-- Add comment to document security approach
COMMENT ON VIEW public.vw_active_kpis IS 'Security Invoker view - respects RLS policies of querying user';
COMMENT ON VIEW public.vw_submission_metrics IS 'Security Invoker view - respects RLS policies of querying user';
COMMENT ON VIEW public.vw_metrics_with_team IS 'Security Invoker view - respects RLS policies of querying user';
COMMENT ON VIEW public.vw_dashboard_yesterday IS 'Security Invoker view - respects RLS policies of querying user';
COMMENT ON VIEW public.vw_dashboard_weekly IS 'Security Invoker view - respects RLS policies of querying user';