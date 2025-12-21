-- Allow viewing profiles of users who have Exchange posts
CREATE POLICY "Users can view exchange post authors"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT user_id FROM exchange_posts
  )
);