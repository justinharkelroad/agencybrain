-- Gate 2: Rename columns from 4F to 4B framework in theta_targets
ALTER TABLE public.theta_targets 
  RENAME COLUMN faith TO body;

ALTER TABLE public.theta_targets 
  RENAME COLUMN family TO being;

ALTER TABLE public.theta_targets 
  RENAME COLUMN fitness TO balance;

ALTER TABLE public.theta_targets 
  RENAME COLUMN finance TO business;

-- Update CHECK constraint in theta_affirmations to use new category names
ALTER TABLE public.theta_affirmations 
  DROP CONSTRAINT IF EXISTS theta_affirmations_category_check;

ALTER TABLE public.theta_affirmations 
  ADD CONSTRAINT theta_affirmations_category_check 
  CHECK (category IN ('body', 'being', 'balance', 'business'));