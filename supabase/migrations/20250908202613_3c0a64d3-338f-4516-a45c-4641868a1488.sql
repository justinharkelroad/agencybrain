-- 1) Add archived_at column for soft deletes
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2) Enforce uniqueness for active KPIs.
-- Role-specific uniqueness is applied once the role column exists.
DO $$
DECLARE
  has_role_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kpis'
      AND column_name = 'role'
  ) INTO has_role_column;

  DROP INDEX IF EXISTS uq_kpis_agency_role_key_active;

  IF has_role_column THEN
    CREATE UNIQUE INDEX uq_kpis_agency_role_key_active
    ON kpis(agency_id, role, key)
    WHERE archived_at IS NULL;
  ELSE
    -- Fallback for environments where role is not yet added.
    DROP INDEX IF EXISTS uq_kpis_agency_key_active;
    CREATE UNIQUE INDEX uq_kpis_agency_key_active
    ON kpis(agency_id, key)
    WHERE archived_at IS NULL;
  END IF;
END $$;

-- 3) Create active KPIs view
CREATE OR REPLACE VIEW vw_active_kpis AS
SELECT *
FROM kpis
WHERE archived_at IS NULL;

-- 4) Speed up lookups
DO $$
DECLARE
  has_role_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kpis'
      AND column_name = 'role'
  ) INTO has_role_column;

  IF has_role_column THEN
    CREATE INDEX IF NOT EXISTS idx_kpis_agency_role
    ON kpis(agency_id, role) 
    WHERE archived_at IS NULL;
  END IF;
END $$;
