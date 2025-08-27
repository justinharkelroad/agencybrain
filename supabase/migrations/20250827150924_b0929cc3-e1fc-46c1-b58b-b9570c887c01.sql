-- Create Service scorecard_rules for existing agency
INSERT INTO scorecard_rules (
  agency_id, 
  role, 
  n_required, 
  weights, 
  selected_metrics, 
  ring_metrics,
  counted_days,
  count_weekend_if_submitted
) 
SELECT 
  agency_id,
  'Service'::app_member_role,
  2,
  '{"outbound_calls": 5, "talk_minutes": 5, "cross_sells_uncovered": 10, "mini_reviews": 10}'::jsonb,
  ARRAY['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews'],
  ARRAY['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews'],
  '{"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": false, "thursday": true, "wednesday": true}'::jsonb,
  true
FROM scorecard_rules 
WHERE role = 'Sales'
ON CONFLICT (agency_id, role) DO UPDATE SET
  selected_metrics = EXCLUDED.selected_metrics,
  ring_metrics = EXCLUDED.ring_metrics,
  weights = EXCLUDED.weights;