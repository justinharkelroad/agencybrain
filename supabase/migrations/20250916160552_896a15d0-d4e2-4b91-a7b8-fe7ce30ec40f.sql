-- Create helper view to lookup metrics by submission id
CREATE OR REPLACE VIEW vw_submission_metrics AS
SELECT md.final_submission_id AS submission_id,
       md.outbound_calls, 
       md.talk_minutes, 
       md.quoted_count, 
       md.sold_items
FROM metrics_daily md
WHERE md.final_submission_id IS NOT NULL;