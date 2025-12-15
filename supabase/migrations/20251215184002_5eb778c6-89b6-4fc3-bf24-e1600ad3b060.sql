-- Allow service-call scores to be stored with one decimal place (and keep compatibility with existing 0-100 integer scores)
ALTER TABLE public.agency_calls
ALTER COLUMN overall_score TYPE numeric(4,1)
USING overall_score::numeric(4,1);