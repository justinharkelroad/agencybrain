-- Force PostgREST schema cache reload after check_call_scoring_access return type change
NOTIFY pgrst, 'reload schema';
