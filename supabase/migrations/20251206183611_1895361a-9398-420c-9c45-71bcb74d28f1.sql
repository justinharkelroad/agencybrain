-- Deactivate unlinked test_staff user to prevent 403 errors on form submission
UPDATE public.staff_users 
SET is_active = false 
WHERE id = '50b0df09-2f55-48e9-9347-0f1246546549' 
  AND team_member_id IS NULL;