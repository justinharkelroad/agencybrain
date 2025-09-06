-- Manually recalculate Connor's scores
SELECT upsert_metrics_from_submission(id) 
FROM submissions 
WHERE team_member_id = '077ccfbb-f84d-4145-82c4-6475add15b38' 
AND final = true 
ORDER BY submitted_at DESC 
LIMIT 3;