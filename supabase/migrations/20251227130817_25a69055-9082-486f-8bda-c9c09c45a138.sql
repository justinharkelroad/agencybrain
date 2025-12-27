-- Clean up orphaned in_progress sessions with no responses for correct user ID
DELETE FROM flow_sessions 
WHERE user_id = '9061db1c-2bf4-4f3d-870c-a522b5f1e1db' 
AND status = 'in_progress' 
AND (responses_json::text = '{}' OR responses_json::text = '[]');