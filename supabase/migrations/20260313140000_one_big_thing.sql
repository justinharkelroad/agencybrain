-- One Big Thing: weekly anchor item for the playbook
-- Adds 'one_big_thing' to zone CHECK constraint and reflection columns

-- ============================================
-- 1. Expand zone CHECK to include one_big_thing
-- ============================================

-- Drop the existing zone CHECK constraint regardless of auto-generated name
DO $$
DECLARE
  _conname text;
BEGIN
  SELECT con.conname INTO _conname
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid
    AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.focus_items'::regclass
    AND att.attname = 'zone'
    AND con.contype = 'c';

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.focus_items DROP CONSTRAINT %I', _conname);
  END IF;
END;
$$;

ALTER TABLE public.focus_items
  ADD CONSTRAINT focus_items_zone_check CHECK (zone IN ('bench', 'power_play', 'queue', 'one_big_thing'));

-- ============================================
-- 2. Reflection columns (filled on completion)
-- ============================================

ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS completion_proof TEXT,
  ADD COLUMN IF NOT EXISTS completion_feeling TEXT;
