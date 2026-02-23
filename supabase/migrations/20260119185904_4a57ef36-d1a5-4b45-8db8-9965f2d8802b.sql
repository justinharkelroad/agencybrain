-- Add winback tables to Realtime publication so subscriptions actually receive events.
-- Guard against environments where winback tables are not present yet in migration order.
DO $$
BEGIN
  IF to_regclass('public.winback_activities') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel rel
      JOIN pg_class c ON c.oid = rel.prrelid
      JOIN pg_publication p ON p.oid = rel.prpubid
      WHERE p.pubname = 'supabase_realtime'
        AND c.relname = 'winback_activities'
        AND c.relnamespace = 'public'::regnamespace
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.winback_activities;
    END IF;
  END IF;

  IF to_regclass('public.winback_households') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel rel
      JOIN pg_class c ON c.oid = rel.prrelid
      JOIN pg_publication p ON p.oid = rel.prpubid
      WHERE p.pubname = 'supabase_realtime'
        AND c.relname = 'winback_households'
        AND c.relnamespace = 'public'::regnamespace
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.winback_households;
    END IF;
  END IF;
END $$;
