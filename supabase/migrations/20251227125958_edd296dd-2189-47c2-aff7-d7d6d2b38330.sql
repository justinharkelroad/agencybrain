-- Clean up orphaned in_progress sessions with no responses for user justin@hfiagencies.com
DELETE FROM flow_sessions 
WHERE user_id = '0edcf9b5-df8c-4c7a-a0b3-d921a6abadab' 
AND status = 'in_progress' 
AND (responses_json::text = '{}' OR responses_json::text = '[]');