-- Comp plans policy-type filter should store policy names (e.g. "Condo"),
-- not policy_type UUIDs. Convert existing values safely and switch type.

ALTER TABLE public.comp_plans
ADD COLUMN policy_type_filter_text text[];

UPDATE public.comp_plans cp
SET policy_type_filter_text = CASE
  WHEN cp.policy_type_filter IS NULL THEN NULL
  ELSE ARRAY(
    SELECT COALESCE(pt.name, filter_id::text)
    FROM unnest(cp.policy_type_filter) AS filter_id
    LEFT JOIN public.policy_types pt
      ON pt.id = filter_id
  )
END;

ALTER TABLE public.comp_plans
DROP COLUMN policy_type_filter;

ALTER TABLE public.comp_plans
RENAME COLUMN policy_type_filter_text TO policy_type_filter;
