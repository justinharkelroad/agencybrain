-- Rename column from is_discovery_stack to is_discovery_flow
ALTER TABLE public.challenge_lessons 
  RENAME COLUMN is_discovery_stack TO is_discovery_flow;

-- Add a comment for documentation
COMMENT ON COLUMN public.challenge_lessons.is_discovery_flow IS 
  'Indicates Friday lessons that should link to the Discovery Flow';