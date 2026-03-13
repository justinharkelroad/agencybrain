-- Fix: Admin users could not update agency_call_balance via client SDK
-- because only service_role had write access. The "Save Settings" button
-- on AdminAgencyCallScoring silently failed to sync subscription_calls_limit.

-- Allow admins to UPDATE existing call balance rows
CREATE POLICY "Admins can update call balance"
  ON public.agency_call_balance FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Allow admins to INSERT call balance rows (for agencies that don't have one yet)
CREATE POLICY "Admins can insert call balance"
  ON public.agency_call_balance FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
