-- Fix: onboarding_tokens FK to auth.users blocks admin-delete-user
-- Change to SET NULL so deleting the user doesn't fail
ALTER TABLE onboarding_tokens
  DROP CONSTRAINT IF EXISTS onboarding_tokens_used_by_user_id_fkey;

ALTER TABLE onboarding_tokens
  ADD CONSTRAINT onboarding_tokens_used_by_user_id_fkey
  FOREIGN KEY (used_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Same for agency FK — agency may be deleted when user is deleted
ALTER TABLE onboarding_tokens
  DROP CONSTRAINT IF EXISTS onboarding_tokens_used_by_agency_id_fkey;

ALTER TABLE onboarding_tokens
  ADD CONSTRAINT onboarding_tokens_used_by_agency_id_fkey
  FOREIGN KEY (used_by_agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
