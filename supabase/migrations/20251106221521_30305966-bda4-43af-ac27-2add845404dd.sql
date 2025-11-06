-- Fix snapshot_planner cascade to prevent constraint violations on user deletion
ALTER TABLE public.snapshot_planner 
  DROP CONSTRAINT IF EXISTS snapshot_planner_user_id_fkey,
  ADD CONSTRAINT snapshot_planner_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Fix user_roles_audit cascade - use SET NULL to preserve audit trail
ALTER TABLE public.user_roles_audit 
  DROP CONSTRAINT IF EXISTS user_roles_audit_changed_by_fkey,
  ADD CONSTRAINT user_roles_audit_changed_by_fkey 
    FOREIGN KEY (changed_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;