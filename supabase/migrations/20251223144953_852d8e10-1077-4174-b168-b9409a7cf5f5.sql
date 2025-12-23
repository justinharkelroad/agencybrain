-- Create core4_entries table for daily Core 4 tracking
CREATE TABLE public.core4_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  body_completed boolean DEFAULT false,
  being_completed boolean DEFAULT false,
  balance_completed boolean DEFAULT false,
  business_completed boolean DEFAULT false,
  body_note text,
  being_note text,
  balance_note text,
  business_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create core4_monthly_missions table
CREATE TABLE public.core4_monthly_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK (domain IN ('body', 'being', 'balance', 'business')),
  title text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  weekly_measurable text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  month_year text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create helper function to get user's agency_id via staff_users -> team_members
CREATE OR REPLACE FUNCTION public.get_user_agency_id(target_user_id uuid)
RETURNS uuid AS $$
DECLARE
  result_agency_id uuid;
BEGIN
  -- Check if target user is a staff_user linked to a team_member
  SELECT tm.agency_id INTO result_agency_id
  FROM staff_users su
  JOIN team_members tm ON tm.id = su.team_member_id
  WHERE su.id = target_user_id;
  
  RETURN result_agency_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create helper function to check if current user is agency owner of target user
CREATE OR REPLACE FUNCTION public.is_agency_owner_of_staff(target_user_id uuid)
RETURNS boolean AS $$
DECLARE
  viewer_agency_id uuid;
  target_agency_id uuid;
  is_owner boolean;
  is_key_emp boolean;
BEGIN
  -- Get viewer's agency_id from profiles
  SELECT p.agency_id INTO viewer_agency_id
  FROM profiles p
  WHERE p.id = auth.uid();
  
  -- Check if viewer is owner (has agency_id)
  is_owner := viewer_agency_id IS NOT NULL;
  
  -- Check if viewer is key employee for this agency
  IF NOT is_owner THEN
    SELECT ke.agency_id INTO viewer_agency_id
    FROM key_employees ke
    WHERE ke.user_id = auth.uid();
    
    is_key_emp := viewer_agency_id IS NOT NULL;
  END IF;
  
  IF NOT is_owner AND NOT is_key_emp THEN
    RETURN false;
  END IF;
  
  -- Get target user's agency via staff_users -> team_members
  target_agency_id := public.get_user_agency_id(target_user_id);
  
  RETURN viewer_agency_id = target_agency_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS on core4_entries
ALTER TABLE public.core4_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for core4_entries
CREATE POLICY "Users can view own entries"
  ON core4_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON core4_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON core4_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON core4_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Agency owners can view team entries"
  ON core4_entries FOR SELECT
  USING (public.is_agency_owner_of_staff(user_id));

-- Enable RLS on core4_monthly_missions
ALTER TABLE public.core4_monthly_missions ENABLE ROW LEVEL SECURITY;

-- RLS policies for core4_monthly_missions
CREATE POLICY "Users can manage own missions"
  ON core4_monthly_missions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Agency owners can view team missions"
  ON core4_monthly_missions FOR SELECT
  USING (public.is_agency_owner_of_staff(user_id));

-- Create indexes for performance
CREATE INDEX idx_core4_entries_user_date ON core4_entries(user_id, date);
CREATE INDEX idx_core4_missions_user_status ON core4_monthly_missions(user_id, status);
CREATE INDEX idx_core4_missions_month_year ON core4_monthly_missions(month_year);

-- Add update trigger for core4_entries
CREATE TRIGGER update_core4_entries_updated_at
  BEFORE UPDATE ON core4_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add update trigger for core4_monthly_missions
CREATE TRIGGER update_core4_monthly_missions_updated_at
  BEFORE UPDATE ON core4_monthly_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();