-- Add profile_photo_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload their own profile photo (stored in folder named after their user id)
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: Users can update their own profile photo
CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: Users can delete their own profile photo
CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: Anyone can view profile photos (public bucket)
CREATE POLICY "Profile photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');