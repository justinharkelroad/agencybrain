-- Backfill existing comments that have null user_name
UPDATE public.training_comments tc
SET user_name = COALESCE(
  (SELECT full_name FROM profiles WHERE id = tc.user_id),
  (SELECT name FROM team_members WHERE user_id = tc.user_id),
  'Anonymous'
)
WHERE user_name IS NULL;