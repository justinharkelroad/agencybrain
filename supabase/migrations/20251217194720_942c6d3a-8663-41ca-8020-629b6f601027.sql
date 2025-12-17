-- Create key_employees table (following user_roles pattern for security)
CREATE TABLE public.key_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, agency_id)
);

-- Enable RLS
ALTER TABLE public.key_employees ENABLE ROW LEVEL SECURITY;

-- Create key_employee_invites table for invitation flow
CREATE TABLE public.key_employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.key_employee_invites ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check key employee status (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_key_employee(_user_id UUID, _agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.key_employees
    WHERE user_id = _user_id AND agency_id = _agency_id
  )
$$;

-- Create function to get key employee's agency_id
CREATE OR REPLACE FUNCTION public.get_key_employee_agency_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.key_employees
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for key_employees table

-- Admins can view all key employees
CREATE POLICY "Admins can view all key employees"
ON public.key_employees
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Agency owners can view their agency's key employees
CREATE POLICY "Agency owners can view own agency key employees"
ON public.key_employees
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
);

-- Agency owners can insert key employees for their agency
CREATE POLICY "Agency owners can insert key employees"
ON public.key_employees
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
);

-- Agency owners can delete key employees from their agency
CREATE POLICY "Agency owners can delete key employees"
ON public.key_employees
FOR DELETE
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
);

-- Users can view their own key employee record
CREATE POLICY "Users can view own key employee record"
ON public.key_employees
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for key_employee_invites table

-- Admins can view all invites
CREATE POLICY "Admins can view all key employee invites"
ON public.key_employee_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Agency owners can manage their invites
CREATE POLICY "Agency owners can manage own invites"
ON public.key_employee_invites
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
)
WITH CHECK (
  agency_id IN (
    SELECT p.agency_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
);

-- Public can select invites by token (for validation)
CREATE POLICY "Anyone can validate invite by token"
ON public.key_employee_invites
FOR SELECT
TO authenticated
USING (true);