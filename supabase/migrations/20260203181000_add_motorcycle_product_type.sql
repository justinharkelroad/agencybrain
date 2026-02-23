-- Add Motorcycle to global product_types
-- Motorcycle was missing from the default product types list

DO $$
DECLARE
  v_motorcycle_product_type_id UUID;
BEGIN
  IF to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203181000_add_motorcycle_product_type: table public.product_types does not exist.';
    RETURN;
  END IF;

  INSERT INTO public.product_types (
    name, category, default_points, is_vc_item, term_months, is_brokered, is_active, agency_id
  )
  SELECT
    'Motorcycle',
    'Auto',
    5,
    true,
    12,
    false,
    true,
    NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_types pt
    WHERE LOWER(pt.name) = 'motorcycle'
      AND pt.agency_id IS NULL
  );

  SELECT id INTO v_motorcycle_product_type_id
  FROM public.product_types
  WHERE LOWER(name) = 'motorcycle'
    AND agency_id IS NULL
  LIMIT 1;

  -- If product_types does not exist at this point, the earlier check prevents this
  IF v_motorcycle_product_type_id IS NULL THEN
    RAISE NOTICE 'Skipping 20260203181000_add_motorcycle_product_type: Motorcycle global product type is still missing.';
    RETURN;
  END IF;

  -- Also ensure it's linked in any agency's policy_types that have "Motorcycle" as a name
  IF to_regclass('public.policy_types') IS NOT NULL THEN
    UPDATE public.policy_types pt
    SET product_type_id = v_motorcycle_product_type_id
    WHERE LOWER(pt.name) LIKE '%motorcycle%'
      AND pt.product_type_id IS NULL;
  ELSE
    RAISE NOTICE 'Skipping policy_types update in 20260203181000_add_motorcycle_product_type: table public.policy_types does not exist.';
  END IF;
END $$;
