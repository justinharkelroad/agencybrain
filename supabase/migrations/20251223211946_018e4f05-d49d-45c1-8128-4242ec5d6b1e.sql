-- Add RLS policies for agency owners to view staff Core 4 data

-- Policy for staff_core4_entries: Allow agency owners (users with matching agency_id) to SELECT staff entries
CREATE POLICY "Agency owners can view staff core4 entries"
ON public.staff_core4_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_users su
    JOIN profiles p ON p.agency_id = su.agency_id
    WHERE su.id = staff_core4_entries.staff_user_id
    AND p.id = auth.uid()
  )
);

-- Policy for staff_core4_entries: Allow key employees to SELECT staff entries  
CREATE POLICY "Key employees can view staff core4 entries"
ON public.staff_core4_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_users su
    JOIN key_employees ke ON ke.agency_id = su.agency_id
    WHERE su.id = staff_core4_entries.staff_user_id
    AND ke.user_id = auth.uid()
  )
);

-- Policy for staff_core4_monthly_missions: Allow agency owners (users with matching agency_id) to SELECT staff missions
CREATE POLICY "Agency owners can view staff core4 missions"
ON public.staff_core4_monthly_missions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_users su
    JOIN profiles p ON p.agency_id = su.agency_id
    WHERE su.id = staff_core4_monthly_missions.staff_user_id
    AND p.id = auth.uid()
  )
);

-- Policy for staff_core4_monthly_missions: Allow key employees to SELECT staff missions
CREATE POLICY "Key employees can view staff core4 missions"
ON public.staff_core4_monthly_missions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_users su
    JOIN key_employees ke ON ke.agency_id = su.agency_id
    WHERE su.id = staff_core4_monthly_missions.staff_user_id
    AND ke.user_id = auth.uid()
  )
);