-- Migration: Fix NULL-role edge cases + Dedupe scorecard_rules arrays

-- ============================================
-- STEP 1: Create role-specific KPIs for agencies that only have NULL-role
-- ============================================

-- For agencies that have NULL-role KPIs but NO role-specific copies, 
-- create Sales AND Service versions before soft-deleting the NULL-role

INSERT INTO kpis (agency_id, key, label, type, is_active, role, color)
SELECT 
  k.agency_id,
  k.key,
  k.label,
  COALESCE(k.type, 'number'),
  true,
  role.r::app_member_role AS role,
  k.color
FROM kpis k
CROSS JOIN (SELECT 'Sales'::text AS r UNION ALL SELECT 'Service'::text AS r) role
WHERE k.key IN ('outbound_calls', 'talk_minutes')
  AND k.role IS NULL
  AND k.is_active = true
  AND NOT EXISTS (
    -- Agency has NO role-specific KPIs for this key
    SELECT 1 FROM kpis k2 
    WHERE k2.agency_id = k.agency_id 
      AND k2.key = k.key 
      AND k2.role IS NOT NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 2: Soft-delete ALL remaining NULL-role KPIs for these keys
-- ============================================

UPDATE kpis 
SET 
  is_active = false,
  archived_at = now()
WHERE role IS NULL 
  AND key IN ('outbound_calls', 'talk_minutes')
  AND is_active = true;

-- ============================================
-- STEP 3: Dedupe scorecard_rules.selected_metrics arrays (preserve order, keep first occurrence)
-- ============================================

UPDATE scorecard_rules
SET selected_metrics = (
  SELECT array_agg(elem ORDER BY ord)
  FROM (
    SELECT elem, MIN(ord) as ord
    FROM unnest(selected_metrics) WITH ORDINALITY AS t(elem, ord)
    GROUP BY elem
  ) deduped
)
WHERE selected_metrics IS NOT NULL
  AND array_length(selected_metrics, 1) > (
    SELECT COUNT(DISTINCT elem) FROM unnest(selected_metrics) elem
  );

-- ============================================
-- STEP 4: Dedupe scorecard_rules.ring_metrics arrays (preserve order, keep first occurrence)
-- ============================================

UPDATE scorecard_rules
SET ring_metrics = (
  SELECT array_agg(elem ORDER BY ord)
  FROM (
    SELECT elem, MIN(ord) as ord
    FROM unnest(ring_metrics) WITH ORDINALITY AS t(elem, ord)
    GROUP BY elem
  ) deduped
)
WHERE ring_metrics IS NOT NULL
  AND array_length(ring_metrics, 1) > (
    SELECT COUNT(DISTINCT elem) FROM unnest(ring_metrics) elem
  );