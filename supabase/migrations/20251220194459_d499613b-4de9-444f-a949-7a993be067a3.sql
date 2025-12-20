-- Add foreign key from exchange_posts.user_id to profiles.id
-- This allows PostgREST to understand the relationship for joins
ALTER TABLE exchange_posts
ADD CONSTRAINT exchange_posts_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also add the same for exchange_comments
ALTER TABLE exchange_comments
ADD CONSTRAINT exchange_comments_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- And for exchange_likes
ALTER TABLE exchange_likes
ADD CONSTRAINT exchange_likes_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- And for exchange_reports
ALTER TABLE exchange_reports
ADD CONSTRAINT exchange_reports_reporter_user_id_profiles_fkey
FOREIGN KEY (reporter_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- And for exchange_messages
ALTER TABLE exchange_messages
ADD CONSTRAINT exchange_messages_sender_id_profiles_fkey
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- And for exchange_conversations (both participants)
ALTER TABLE exchange_conversations
ADD CONSTRAINT exchange_conversations_participant_one_profiles_fkey
FOREIGN KEY (participant_one) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE exchange_conversations
ADD CONSTRAINT exchange_conversations_participant_two_profiles_fkey
FOREIGN KEY (participant_two) REFERENCES profiles(id) ON DELETE CASCADE;

-- And for exchange_post_views
ALTER TABLE exchange_post_views
ADD CONSTRAINT exchange_post_views_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;