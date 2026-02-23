-- Remove theta-tracks bucket (no longer storing user-generated tracks)
-- User tracks are now mixed client-side and downloaded immediately (zero storage)

-- Clean up the previous theta-tracks bucket and policies.
-- Direct writes to storage.objects are blocked in this environment, so remove bucket policies first.
DROP POLICY IF EXISTS "Authenticated users can view their tracks" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own tracks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own tracks" ON storage.objects;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'delete_bucket' AND n.nspname = 'storage'
  ) THEN
    PERFORM storage.delete_bucket('theta-tracks');
  ELSE
    DELETE FROM storage.buckets WHERE id = 'theta-tracks';
  END IF;
EXCEPTION
  WHEN undefined_table OR insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'Skipping bucket cleanup for theta-tracks due storage permissions/environment: %', SQLERRM;
END $$;

-- Update theta_tracks table to remove audio_url (no longer needed)
ALTER TABLE theta_tracks DROP COLUMN IF EXISTS audio_url;

-- Add comment explaining the new architecture
COMMENT ON TABLE theta_tracks IS 'Tracks metadata only - audio is mixed client-side and not stored on server';
