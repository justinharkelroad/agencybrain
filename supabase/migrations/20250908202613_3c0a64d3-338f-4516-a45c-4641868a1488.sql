-- 1) Add archived_at column for soft deletes
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2) Enforce uniqueness for active KPIs per agency+role+key
DROP INDEX IF EXISTS uq_kpis_agency_role_key_active;
CREATE UNIQUE INDEX uq_kpis_agency_role_key_active
ON kpis(agency_id, role, key)
WHERE archived_at IS NULL;

-- 3) Create active KPIs view
CREATE OR REPLACE VIEW vw_active_kpis AS
SELECT *
FROM kpis
WHERE archived_at IS NULL;

-- 4) Speed up lookups
CREATE INDEX IF NOT EXISTS idx_kpis_agency_role 
ON kpis(agency_id, role) 
WHERE archived_at IS NULL;