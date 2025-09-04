-- Fix work_date NOT NULL constraint issue
-- The work_date field should be optional, but currently has NOT NULL constraint
-- This causes submission failures when work_date is not provided

ALTER TABLE public.submissions 
ALTER COLUMN work_date DROP NOT NULL;