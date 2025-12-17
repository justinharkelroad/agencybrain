-- EMERGENCY ROLLBACK: Remove all key employee related RLS changes

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Users can view key employee profiles in same agency" ON public.profiles;

-- Step 2: Drop the function if it's causing issues
DROP FUNCTION IF EXISTS public.get_user_agency_id(uuid);

-- Step 3: Verify the basic policies still exist (these should already be there)
-- If they don't exist, recreate them:

-- Check if "Users can view own profile" exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- Check if users can update own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;