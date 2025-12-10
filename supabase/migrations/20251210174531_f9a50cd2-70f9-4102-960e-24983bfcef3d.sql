-- Fix Part 4: Dedupe selected_metrics arrays in scorecard_rules
UPDATE scorecard_rules
SET selected_metrics = (
  SELECT array_agg(DISTINCT elem)
  FROM unnest(selected_metrics) AS elem
)
WHERE selected_metrics IS NOT NULL
  AND array_length(selected_metrics, 1) != (
    SELECT count(DISTINCT elem) FROM unnest(selected_metrics) AS elem
  );