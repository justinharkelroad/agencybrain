DO $$
BEGIN
  IF to_regclass('public.policy_types') IS NULL OR to_regclass('public.product_types') IS NULL THEN
    RAISE NOTICE 'Skipping 20260203184000_fix_default_policy_types_with_links: policy_types or product_types table does not exist.';
    RETURN;
  END IF;

  -- Fix create_default_policy_types to create properly linked policy types for new agencies
  --
  -- Issues:
  -- 1. Old defaults used generic names (Auto Insurance) that don't match product_types
  -- 2. product_type_id was never set, so new agencies get 0 points
  --
  -- Solution: Create policy_types directly from global product_types with the link set
  CREATE OR REPLACE FUNCTION public.create_default_policy_types(p_agency_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  BEGIN
    -- Only insert if no policy types exist for this agency
    IF NOT EXISTS (SELECT 1 FROM public.policy_types WHERE agency_id = p_agency_id) THEN
      -- Create policy_types from global product_types with link already set
      INSERT INTO public.policy_types (agency_id, name, product_type_id, is_active, order_index)
      SELECT
        p_agency_id,
        pt.name,
        pt.id,  -- Set the link directly!
        true,
        ROW_NUMBER() OVER (ORDER BY pt.name)
      FROM public.product_types pt
      WHERE pt.agency_id IS NULL
        AND pt.is_active = true;
    END IF;
  END;
  $func$;

  -- Also link any existing unlinked policy_types that match by name
  -- (re-run the backfill for any that were missed)
  UPDATE public.policy_types pt
  SET product_type_id = matched.product_type_id
  FROM (
    SELECT DISTINCT ON (pt2.id)
      pt2.id as policy_type_id,
      prod.id as product_type_id
    FROM public.policy_types pt2
    JOIN public.product_types prod ON LOWER(TRIM(prod.name)) = LOWER(TRIM(pt2.name))
    WHERE pt2.product_type_id IS NULL
      AND prod.agency_id IS NULL
      AND prod.is_active = true
    ORDER BY pt2.id, prod.agency_id NULLS FIRST
  ) matched
  WHERE pt.id = matched.policy_type_id
    AND pt.product_type_id IS NULL;
END $$;
