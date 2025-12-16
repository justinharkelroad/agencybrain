-- Make token_id nullable to support auth-based saves (logged-in users)
-- Token-based saves (external staff) will continue to have token_id populated
-- Auth-based saves (logged-in users) will have token_id = NULL

ALTER TABLE roleplay_sessions 
ALTER COLUMN token_id DROP NOT NULL;