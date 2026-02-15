-- Allow duplicate staff usernames across agencies.
-- Username uniqueness remains enforced per agency for active users via:
--   staff_users_agency_id_username_active

ALTER TABLE public.staff_users
DROP CONSTRAINT IF EXISTS staff_users_username_key;
