CREATE OR REPLACE VIEW vw_submission_metrics AS
SELECT 
  id AS submission_id,
  COALESCE(
    (payload_json->>'outbound_calls')::integer, 
    0
  ) AS outbound_calls,
  COALESCE(
    (payload_json->>'talk_minutes')::integer, 
    0
  ) AS talk_minutes,
  -- Check both quoted_households (new) and quoted_count (legacy)
  COALESCE(
    (payload_json->>'quoted_households')::integer,
    (payload_json->>'quoted_count')::integer, 
    0
  ) AS quoted_count,
  -- Check both items_sold (new) and sold_items (legacy)
  COALESCE(
    (payload_json->>'items_sold')::integer,
    (payload_json->>'sold_items')::integer, 
    0
  ) AS sold_items
FROM submissions;