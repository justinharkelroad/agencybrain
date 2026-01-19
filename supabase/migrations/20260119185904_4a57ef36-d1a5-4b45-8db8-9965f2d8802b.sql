-- Add winback tables to Realtime publication so subscriptions actually receive events
ALTER PUBLICATION supabase_realtime ADD TABLE public.winback_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.winback_households;