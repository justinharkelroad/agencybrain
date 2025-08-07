-- Add MRR column to profiles and admin update policy
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mrr numeric(12,2);

-- Ensure RLS is enabled (already enabled in schema, kept for idempotency)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow admins to update any profile (including setting MRR)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END
$$;