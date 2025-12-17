-- Fix foreign key constraints that block user deletion

-- period_versions.changed_by -> SET NULL (preserve audit trail, clear user reference)
ALTER TABLE public.period_versions 
DROP CONSTRAINT IF EXISTS period_versions_changed_by_fkey;

ALTER TABLE public.period_versions 
ADD CONSTRAINT period_versions_changed_by_fkey 
FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- period_edit_sessions.user_id -> CASCADE (delete sessions when user deleted)
ALTER TABLE public.period_edit_sessions 
DROP CONSTRAINT IF EXISTS period_edit_sessions_user_id_fkey;

ALTER TABLE public.period_edit_sessions 
ADD CONSTRAINT period_edit_sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- period_backups.user_id -> CASCADE (delete backups when user deleted)
ALTER TABLE public.period_backups 
DROP CONSTRAINT IF EXISTS period_backups_user_id_fkey;

ALTER TABLE public.period_backups 
ADD CONSTRAINT period_backups_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;