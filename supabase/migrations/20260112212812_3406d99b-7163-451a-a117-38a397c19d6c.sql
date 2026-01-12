-- Step 1: Drop the existing unique constraint that blocks role-specific rows
ALTER TABLE kpis DROP CONSTRAINT IF EXISTS kpis_agency_id_key_key;

-- Step 2: Create new unique constraint that includes role
-- Using NULLS NOT DISTINCT so (agency_id, key, NULL) is treated as unique
CREATE UNIQUE INDEX kpis_agency_id_key_role_unique 
ON kpis (agency_id, key, role) NULLS NOT DISTINCT;

-- Step 3: Create role-specific KPI rows for outbound_calls and talk_minutes
INSERT INTO kpis (agency_id, key, label, type, role, is_active, created_at)
SELECT 
  k.agency_id, 
  k.key, 
  k.label, 
  k.type, 
  r.role::app_member_role,
  k.is_active,
  now()
FROM kpis k
CROSS JOIN (VALUES ('Sales'), ('Service')) AS r(role)
WHERE k.key IN ('outbound_calls', 'talk_minutes')
  AND k.role IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM kpis k2 
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