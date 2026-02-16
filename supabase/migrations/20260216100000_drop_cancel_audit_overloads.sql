-- Fix: PostgREST can't resolve overloaded upsert_cancel_audit_record
-- Previous migrations added params with CREATE OR REPLACE, which created
-- new overloads (19-param, 20-param, 21-param) instead of replacing.
-- Drop the old signatures so only the current 21-param version remains.

-- Drop the original 19-param version (from 20260117200000)
DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID
);

-- Drop the 20-param version (from 20260123100000, added p_original_year)
DROP FUNCTION IF EXISTS upsert_cancel_audit_record(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID, TEXT
);

-- The 21-param version (from 20260213000000) remains:
-- upsert_cancel_audit_record(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
--   TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT, BIGINT, DATE, DATE, DATE, UUID, TEXT, TEXT)
