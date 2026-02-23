-- Phase 4: Cleanup audit logs older than 48 hours (observability retention)
-- Create a function to clean up old audit logs for performance

CREATE OR REPLACE FUNCTION public.cleanup_field_mapping_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 48 hours to maintain performance
  DELETE FROM public.field_mapping_audit 
  WHERE created_at < (now() - interval '48 hours');
  
  -- Log how many rows were cleaned up
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % old field mapping audit log entries', deleted_count;
END;
$$;

-- You could set up a cron job to run this cleanup function daily:
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT public.cleanup_field_mapping_audit_logs();');
