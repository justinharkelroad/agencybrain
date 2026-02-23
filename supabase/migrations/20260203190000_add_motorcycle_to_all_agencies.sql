-- Add Motorcycle policy_type to all existing agencies that don't have one
-- Motorcycle was added to product_types but existing agencies were not given this policy type

-- Insert Motorcycle for all agencies that don't already have it
DO $$
DECLARE
  v_motorcycle_product_type_id UUID;
BEGIN
  IF to_regclass('public.agencies') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203190000_add_motorcycle_to_all_agencies: table public.agencies does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.policy_types') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203190000_add_motorcycle_to_all_agencies: table public.policy_types does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203190000_add_motorcycle_to_all_agencies: table public.product_types does not exist.';
    RETURN;
  END IF;

  SELECT id INTO v_motorcycle_product_type_id
  FROM public.product_types
  WHERE name = 'Motorcycle'
    AND agency_id IS NULL
    AND is_active = true
  LIMIT 1;

  IF v_motorcycle_product_type_id IS NULL THEN
    RAISE NOTICE 'Skipping 20260203190000_add_motorcycle_to_all_agencies: no active global Motorcycle product type found.';
    RETURN;
  END IF;

  INSERT INTO public.policy_types (agency_id, name, product_type_id, is_active, order_index)
  SELECT
    a.id as agency_id,
    'Motorcycle' as name,
    v_motorcycle_product_type_id as product_type_id,
    true as is_active,
    COALESCE(
      (SELECT MAX(order_index) + 1 FROM public.policy_types WHERE agency_id = a.id),
      0
    ) as order_index
  FROM public.agencies a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.policy_types
    WHERE agency_id = a.id
      AND LOWER(name) LIKE '%motorcycle%'
  );
END $$;
