-- Normalize selected_metric_slugs keys (sold_items → items_sold, quoted_count → quoted_households)
UPDATE scorecard_rules
SET selected_metric_slugs = (
  SELECT array_agg(
    CASE 
      WHEN elem = 'sold_items' THEN 'items_sold'
      WHEN elem = 'quoted_count' THEN 'quoted_households'
      ELSE elem
    END
  )
  FROM unnest(selected_metric_slugs) AS elem
)
WHERE selected_metric_slugs IS NOT NULL 
  AND array_length(selected_metric_slugs, 1) > 0;

-- Set empty arrays to NULL so fallback logic works
UPDATE scorecard_rules
SET selected_metric_slugs = NULL
WHERE selected_metric_slugs = '{}';

-- Normalize ring_metrics that might still have old keys
UPDATE scorecard_rules
SET ring_metrics = (
  SELECT array_agg(
    CASE 
      WHEN elem = 'sold_items' THEN 'items_sold'
      WHEN elem = 'quoted_count' THEN 'quoted_households'
      ELSE elem
    END
  )
  FROM unnest(ring_metrics) AS elem
)
WHERE ring_metrics IS NOT NULL 
  AND array_length(ring_metrics, 1) > 0;

-- Normalize selected_metrics that might still have old keys
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
WHERE selected_metrics IS NOT NULL 
  AND array_length(selected_metrics, 1) > 0;

-- Fix HFI's selected_metrics to have all 4 KPIs for Sales role
UPDATE scorecard_rules
SET selected_metrics = ARRAY['outbound_calls', 'talk_minutes', 'quoted_households', 'items_sold']
WHERE agency_id = '3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba'
  AND role = 'Sales';