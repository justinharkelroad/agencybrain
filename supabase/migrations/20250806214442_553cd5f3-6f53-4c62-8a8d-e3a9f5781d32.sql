-- Phase 1: Fix RLS policies and add constraints

-- Fix agencies table RLS policies to allow authenticated users to INSERT/UPDATE
DROP POLICY IF EXISTS "Users can insert agencies" ON public.agencies;
DROP POLICY IF EXISTS "Users can update agencies" ON public.agencies;

CREATE POLICY "Authenticated users can insert agencies" 
ON public.agencies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update agencies" 
ON public.agencies 
FOR UPDATE 
TO authenticated
USING (true);

-- Add constraint to prevent period overlaps more strictly
CREATE OR REPLACE FUNCTION public.check_strict_period_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Check if there's an overlapping period for the same user
  IF EXISTS (
    SELECT 1 FROM public.periods 
    WHERE user_id = NEW.user_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.start_date <= end_date AND NEW.end_date >= start_date)
    )
  ) THEN
    RAISE EXCEPTION 'Period dates overlap with existing period for this user. Start: %, End: %', NEW.start_date, NEW.end_date;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS check_period_overlap_trigger ON public.periods;
CREATE TRIGGER check_strict_period_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_strict_period_overlap();

-- Clean up potential duplicate periods (keep the one with more data)
WITH duplicates AS (
  SELECT 
    id,
    user_id,
    start_date,
    end_date,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, start_date, end_date 
      ORDER BY 
        CASE WHEN form_data IS NOT NULL AND jsonb_typeof(form_data) = 'object' THEN 1 ELSE 0 END DESC,
        created_at DESC
    ) as rn
  FROM public.periods
),
to_delete AS (
  SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM public.periods WHERE id IN (SELECT id FROM to_delete);