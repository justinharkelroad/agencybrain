-- Insert default policy types for all agencies that don't already have them
-- This adds all 25 global defaults from product_types to each agency's policy_types
-- Uses name-based deduplication to preserve existing custom types

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260203142634_add_policy_types_defaults: table public.agencies does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260203142634_add_policy_types_defaults: table public.product_types does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.policy_types') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260203142634_add_policy_types_defaults: table public.policy_types does not exist.';
    RETURN;
  END IF;

  INSERT INTO public.policy_types (id, agency_id, name, is_active, order_index, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    a.id,
    pt.name,
    true,
    ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY pt.name) + COALESCE(
      (SELECT MAX(order_index) FROM public.policy_types WHERE agency_id = a.id), 0
    ),
    NOW(),
    NOW()
  FROM public.agencies a
  CROSS JOIN (
    SELECT DISTINCT name FROM public.product_types
    WHERE agency_id IS NULL AND is_active = true
  ) pt
  WHERE NOT EXISTS (
    SELECT 1 FROM public.policy_types
    WHERE agency_id = a.id AND LOWER(name) = LOWER(pt.name)
  );
END $$;
