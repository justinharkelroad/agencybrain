DROP INDEX IF EXISTS public.kpis_agency_id_key_role_unique;
DROP INDEX IF EXISTS public.kpis_agency_id_key_role_key;
DROP INDEX IF EXISTS public.uq_kpis_agency_key_active;
DROP INDEX IF EXISTS public.uq_kpis_agency_role_key_active;

DO $$
BEGIN
  IF to_regclass('public.kpis') IS NULL THEN
    RAISE NOTICE 'Skipping KPI role split cleanup: public.kpis does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.kpis DROP CONSTRAINT IF EXISTS kpis_agency_id_key_key;
END;
$$;

-- Step 2: Create unique constraint that includes role for active KPIs
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpis_agency_role_key_active
ON kpis (agency_id, role, key)
WHERE archived_at IS NULL;

-- Step 3: Create role-specific KPI rows for outbound_calls and talk_minutes
WITH base_kpis AS (
  SELECT DISTINCT ON (k.agency_id, k.key)
    k.agency_id,
    k.key,
    k.label,
    k.type,
    k.is_active
  FROM kpis k
  WHERE k.key IN ('outbound_calls', 'talk_minutes')
    AND k.role IS NULL
  ORDER BY k.agency_id, k.key, k.created_at NULLS LAST
)
INSERT INTO kpis (agency_id, key, label, type, role, is_active, created_at)
SELECT
  k.agency_id,
  k.key,
  k.label,
  k.type,
  r.role::app_member_role,
  k.is_active,
  now()
FROM base_kpis k
CROSS JOIN (VALUES ('Sales'), ('Service')) AS r(role)
WHERE NOT EXISTS (
  SELECT 1
  FROM kpis k2
  WHERE k2.agency_id = k.agency_id
    AND k2.key = k.key
    AND k2.role::text = r.role
);

-- Step 4: Create kpi_versions for the new role-specific rows
INSERT INTO kpi_versions (kpi_id, label, valid_from)
SELECT k.id, k.label, now()
FROM kpis k
WHERE k.role IS NOT NULL
  AND k.key IN ('outbound_calls', 'talk_minutes')
  AND NOT EXISTS (
    SELECT 1 FROM kpi_versions v WHERE v.kpi_id = k.id
  );
