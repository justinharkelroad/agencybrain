-- ============================================
-- Renewal Tool Phase 1 Database Migration
-- ============================================

-- 1. Create access control function
CREATE OR REPLACE FUNCTION public.has_renewal_access(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = COALESCE(_user_id, auth.uid())
      AND (p.role = 'admin' OR p.agency_id = _agency_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = COALESCE(_user_id, (current_setting('request.jwt.claims', true)::jsonb->>'staff_member_id')::uuid)
      AND tm.agency_id = _agency_id
      AND tm.status = 'active'
  )
$$;

-- 2. Create renewal_uploads table
CREATE TABLE public.renewal_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid REFERENCES auth.users(id),
  uploaded_by_staff_id uuid REFERENCES public.team_members(id),
  uploaded_by_name text NOT NULL,
  file_name text,
  records_processed integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on renewal_uploads
ALTER TABLE public.renewal_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for renewal_uploads
CREATE POLICY "renewal_uploads_select" ON public.renewal_uploads
  FOR SELECT USING (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_uploads_insert" ON public.renewal_uploads
  FOR INSERT WITH CHECK (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_uploads_delete" ON public.renewal_uploads
  FOR DELETE USING (has_renewal_access(auth.uid(), agency_id));

-- 3. Create renewal_records table
CREATE TABLE public.renewal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  policy_number text NOT NULL,
  household_key text NOT NULL,
  insured_first_name text,
  insured_last_name text,
  insured_email text,
  insured_phone text,
  insured_phone_alt text,
  agent_number text,
  product_name text,
  premium_cents integer,
  no_of_items integer,
  account_type text CHECK (account_type IS NULL OR account_type IN ('personal', 'commercial')),
  renewal_effective_date date,
  renewal_status text NOT NULL DEFAULT 'upcoming' CHECK (renewal_status IN ('upcoming', 'contacted', 'quoted', 'retained', 'lost')),
  current_status text NOT NULL DEFAULT 'new' CHECK (current_status IN ('new', 'in_progress', 'resolved', 'lost')),
  assigned_to uuid REFERENCES public.team_members(id),
  is_active boolean NOT NULL DEFAULT true,
  last_upload_id uuid REFERENCES public.renewal_uploads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, policy_number, renewal_effective_date)
);

-- Enable RLS on renewal_records
ALTER TABLE public.renewal_records ENABLE ROW LEVEL SECURITY;

-- Indexes for renewal_records
CREATE INDEX idx_renewal_records_agency_active ON public.renewal_records(agency_id, is_active);
CREATE INDEX idx_renewal_records_status ON public.renewal_records(agency_id, current_status);
CREATE INDEX idx_renewal_records_effective_date ON public.renewal_records(agency_id, renewal_effective_date);
CREATE INDEX idx_renewal_records_assigned ON public.renewal_records(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_renewal_records_product ON public.renewal_records(agency_id, product_name);
CREATE INDEX idx_renewal_records_upload ON public.renewal_records(last_upload_id);

-- RLS policies for renewal_records
CREATE POLICY "renewal_records_select" ON public.renewal_records
  FOR SELECT USING (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_records_insert" ON public.renewal_records
  FOR INSERT WITH CHECK (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_records_update" ON public.renewal_records
  FOR UPDATE USING (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_records_delete" ON public.renewal_records
  FOR DELETE USING (has_renewal_access(auth.uid(), agency_id));

-- 4. Create renewal_activities table
CREATE TABLE public.renewal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.renewal_records(id) ON DELETE CASCADE,
  household_key text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('status_change', 'assignment', 'note', 'contact_attempt', 'quote_sent', 'follow_up_scheduled')),
  notes text,
  user_id uuid,
  staff_member_id uuid REFERENCES public.team_members(id),
  user_display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on renewal_activities
ALTER TABLE public.renewal_activities ENABLE ROW LEVEL SECURITY;

-- Index for renewal_activities
CREATE INDEX idx_renewal_activities_record ON public.renewal_activities(record_id);

-- RLS policies for renewal_activities
CREATE POLICY "renewal_activities_select" ON public.renewal_activities
  FOR SELECT USING (has_renewal_access(auth.uid(), agency_id));

CREATE POLICY "renewal_activities_insert" ON public.renewal_activities
  FOR INSERT WITH CHECK (has_renewal_access(auth.uid(), agency_id));

-- 5. Create upsert_renewal_record RPC function
CREATE OR REPLACE FUNCTION public.upsert_renewal_record(
  p_agency_id uuid,
  p_policy_number text,
  p_household_key text,
  p_insured_first_name text DEFAULT NULL,
  p_insured_last_name text DEFAULT NULL,
  p_insured_email text DEFAULT NULL,
  p_insured_phone text DEFAULT NULL,
  p_insured_phone_alt text DEFAULT NULL,
  p_agent_number text DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_premium_cents integer DEFAULT NULL,
  p_no_of_items integer DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_renewal_effective_date date DEFAULT NULL,
  p_last_upload_id uuid DEFAULT NULL
)
RETURNS TABLE(record_id uuid, was_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_was_created boolean := false;
BEGIN
  -- Check for existing record
  SELECT id INTO v_record_id
  FROM renewal_records
  WHERE agency_id = p_agency_id
    AND policy_number = p_policy_number
    AND (renewal_effective_date = p_renewal_effective_date OR (renewal_effective_date IS NULL AND p_renewal_effective_date IS NULL));

  IF v_record_id IS NULL THEN
    -- Insert new record
    INSERT INTO renewal_records (
      agency_id, policy_number, household_key,
      insured_first_name, insured_last_name, insured_email,
      insured_phone, insured_phone_alt, agent_number,
      product_name, premium_cents, no_of_items, account_type,
      renewal_effective_date, last_upload_id, is_active
    ) VALUES (
      p_agency_id, p_policy_number, p_household_key,
      p_insured_first_name, p_insured_last_name, p_insured_email,
      p_insured_phone, p_insured_phone_alt, p_agent_number,
      p_product_name, p_premium_cents, p_no_of_items, p_account_type,
      p_renewal_effective_date, p_last_upload_id, true
    )
    RETURNING id INTO v_record_id;
    v_was_created := true;
  ELSE
    -- Update existing record
    UPDATE renewal_records
    SET household_key = COALESCE(p_household_key, household_key),
        insured_first_name = COALESCE(p_insured_first_name, insured_first_name),
        insured_last_name = COALESCE(p_insured_last_name, insured_last_name),
        insured_email = COALESCE(p_insured_email, insured_email),
        insured_phone = COALESCE(p_insured_phone, insured_phone),
        insured_phone_alt = COALESCE(p_insured_phone_alt, insured_phone_alt),
        agent_number = COALESCE(p_agent_number, agent_number),
        product_name = COALESCE(p_product_name, product_name),
        premium_cents = COALESCE(p_premium_cents, premium_cents),
        no_of_items = COALESCE(p_no_of_items, no_of_items),
        account_type = COALESCE(p_account_type, account_type),
        last_upload_id = COALESCE(p_last_upload_id, last_upload_id),
        is_active = true,
        updated_at = now()
    WHERE id = v_record_id;
  END IF;

  RETURN QUERY SELECT v_record_id, v_was_created;
END;
$$;