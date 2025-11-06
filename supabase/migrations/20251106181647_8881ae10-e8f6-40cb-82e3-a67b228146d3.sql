-- Create enum type for membership tiers
CREATE TYPE public.membership_tier AS ENUM ('1:1 Coaching', 'Boardroom');

-- Add membership_tier column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN membership_tier public.membership_tier NOT NULL DEFAULT '1:1 Coaching';

-- Update all existing users to '1:1 Coaching' (as requested)
UPDATE public.profiles 
SET membership_tier = '1:1 Coaching' 
WHERE membership_tier IS NULL;

-- Add index for performance
CREATE INDEX idx_profiles_membership_tier ON public.profiles(membership_tier);

-- Update the handle_new_user trigger function to read membership_tier from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, membership_tier)
  VALUES (
    new.id, 
    COALESCE(
      (new.raw_user_meta_data->>'membership_tier')::public.membership_tier,
      '1:1 Coaching'::public.membership_tier
    )
  );
  RETURN new;
END;
$$;