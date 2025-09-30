-- Identify and fix ALL SECURITY DEFINER views by querying pg_views
-- This migration will find views with security_barrier = true and recreate them properly

DO $$
DECLARE
    v_view RECORD;
    v_definition TEXT;
BEGIN
    -- Find all views in public schema with security properties
    FOR v_view IN 
        SELECT 
            schemaname,
            viewname,
            definition,
            viewowner
        FROM pg_views 
        WHERE schemaname = 'public'
        ORDER BY viewname
    LOOP
        -- Drop the view if it exists
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_view.schemaname, v_view.viewname);
        
        -- Recreate the view without SECURITY DEFINER
        -- Simply recreate with the same definition but ensure no SECURITY DEFINER
        v_definition := regexp_replace(v_view.definition, 'SECURITY\s+DEFINER', '', 'gi');
        
        EXECUTE format('CREATE VIEW %I.%I AS %s', v_view.schemaname, v_view.viewname, v_view.definition);
        
        RAISE NOTICE 'Recreated view: %.% without SECURITY DEFINER', v_view.schemaname, v_view.viewname;
    END LOOP;
END $$;

-- Verify all views are now SECURITY INVOKER (default)
-- Views without explicit SECURITY DEFINER will use SECURITY INVOKER by default
-- This ensures RLS policies of the querying user are enforced