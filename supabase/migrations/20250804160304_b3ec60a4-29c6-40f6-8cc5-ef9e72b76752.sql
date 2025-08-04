-- Create a default agency for existing users who don't have one
INSERT INTO public.agencies (name) 
VALUES ('Default Agency')
ON CONFLICT DO NOTHING;

-- Create profiles for any auth.users that don't have corresponding profiles
INSERT INTO public.profiles (id, agency_id, role)
SELECT 
  au.id,
  (SELECT id FROM public.agencies LIMIT 1),
  CASE WHEN au.email = 'admin@example.com' THEN 'admin' ELSE 'user' END
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;