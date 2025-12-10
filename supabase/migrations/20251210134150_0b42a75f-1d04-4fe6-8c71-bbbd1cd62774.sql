
-- Fix key mismatches in scorecard_rules.selected_metrics for ALL agencies
-- Replace old keys with correct keys:
-- sold_items -> items_sold
-- quoted_count -> quoted_households

-- Update Sales role selected_metrics across all agencies
UPDATE scorecard_rules 
SET selected_metrics = (
  SELECT array_agg(
    CASE 
      WHEN elem = 'sold_items' THEN 'items_sold'
      WHEN elem = 'quoted_count' THEN 'quoted_households'
      ELSE elem
    END
  )
  FROM unnest(selected_metrics) AS elem
)
WHERE 'sold_items' = ANY(selected_metrics) OR 'quoted_count' = ANY(selected_metrics);

-- Deactivate legacy duplicate KPIs (sold_items, quoted_count) across all agencies
UPDATE kpis 
SET is_active = false, archived_at = now()
WHERE key IN ('sold_items', 'quoted_count')
AND is_active = true;
