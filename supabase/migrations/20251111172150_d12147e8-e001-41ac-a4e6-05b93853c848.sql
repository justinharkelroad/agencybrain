
-- Enable RLS on user_roles_audit table
ALTER TABLE public.user_roles_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit records
CREATE POLICY "Admins can view all role audit records"
ON public.user_roles_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own role audit records
CREATE POLICY "Users can view their own role audit records"
ON public.user_roles_audit
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert audit records (authenticated users can log their own changes)
CREATE POLICY "Authenticated users can insert role audit records"
ON public.user_roles_audit
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies - audit records are immutable
