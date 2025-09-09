-- Change get_versioned_dashboard_data to SECURITY INVOKER for better security with RLS
ALTER FUNCTION public.get_versioned_dashboard_data(text, text, boolean) SECURITY INVOKER;