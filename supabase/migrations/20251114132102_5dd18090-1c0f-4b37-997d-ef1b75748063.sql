-- Remove theta-tracks bucket (no longer storing user-generated tracks)
-- User tracks are now mixed client-side and downloaded immediately (zero storage)

-- First, delete all objects from the theta-tracks bucket
DELETE FROM storage.objects WHERE bucket_id = 'theta-tracks';

-- Drop all RLS policies for theta-tracks bucket
DROP POLICY IF EXISTS "Authenticated users can view their tracks" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own tracks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own tracks" ON storage.objects;

-- Now delete the bucket itself
DELETE FROM storage.buckets WHERE id = 'theta-tracks';

-- Update theta_tracks table to remove audio_url (no longer needed)
ALTER TABLE theta_tracks DROP COLUMN IF EXISTS audio_url;

-- Add comment explaining the new architecture
COMMENT ON TABLE theta_tracks IS 'Tracks metadata only - audio is mixed client-side and not stored on server';