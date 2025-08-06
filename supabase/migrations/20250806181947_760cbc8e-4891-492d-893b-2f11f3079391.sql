-- Fix security warnings by setting proper search_path for functions

-- Update check_period_overlap function with security definer and search_path
CREATE OR REPLACE FUNCTION check_period_overlap()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if there's an overlapping period for the same user
  IF EXISTS (
    SELECT 1 FROM public.periods 
    WHERE user_id = NEW.user_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.start_date BETWEEN start_date AND end_date) OR
      (NEW.end_date BETWEEN start_date AND end_date) OR
      (start_date BETWEEN NEW.start_date AND NEW.end_date) OR
      (end_date BETWEEN NEW.start_date AND NEW.end_date)
    )
  ) THEN
    RAISE EXCEPTION 'Period dates overlap with existing period for this user';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_period_status function with security definer and search_path
CREATE OR REPLACE FUNCTION update_period_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If form_data has substantial content, mark as complete
  IF NEW.form_data IS NOT NULL AND 
     jsonb_typeof(NEW.form_data) = 'object' AND
     NEW.form_data ? 'sales' AND 
     NEW.form_data ? 'marketing' AND
     NEW.form_data ? 'cashFlow' THEN
    NEW.status = 'complete';
  ELSIF NEW.form_data IS NOT NULL AND 
        jsonb_typeof(NEW.form_data) = 'object' AND
        jsonb_object_keys(NEW.form_data) IS NOT NULL THEN
    NEW.status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$;