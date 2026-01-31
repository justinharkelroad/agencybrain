-- Fix VOIP RPC functions to validate caller has agency access
-- This prevents cross-agency data access via direct RPC calls

-- 1. Get call metrics for a specific staff member
CREATE OR REPLACE FUNCTION get_staff_call_metrics(
  p_team_member_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  total_calls INTEGER,
  inbound_calls INTEGER,
  outbound_calls INTEGER,
  answered_calls INTEGER,
  missed_calls INTEGER,
  total_talk_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Validate team member exists and get agency_id
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Invalid team member ID';
  END IF;

  -- Validate caller has access to this agency
  IF NOT has_agency_access(auth.uid(), v_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to this agency data';
  END IF;

  RETURN QUERY
  SELECT
    cmd.date,
    cmd.total_calls,
    cmd.inbound_calls,
    cmd.outbound_calls,
    cmd.answered_calls,
    cmd.missed_calls,
    cmd.total_talk_seconds
  FROM call_metrics_daily cmd
  WHERE cmd.team_member_id = p_team_member_id
    AND cmd.agency_id = v_agency_id
    AND cmd.date BETWEEN p_start_date AND p_end_date
  ORDER BY cmd.date DESC;
END;
$$;

-- 2. Get aggregated call metrics for the entire agency
CREATE OR REPLACE FUNCTION get_agency_call_metrics(
  p_team_member_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  total_calls INTEGER,
  inbound_calls INTEGER,
  outbound_calls INTEGER,
  answered_calls INTEGER,
  missed_calls INTEGER,
  total_talk_seconds INTEGER,
  team_member_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Validate team member exists and get agency_id
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Invalid team member ID';
  END IF;

  -- Validate caller has access to this agency
  IF NOT has_agency_access(auth.uid(), v_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to this agency data';
  END IF;

  RETURN QUERY
  SELECT
    cmd.date,
    SUM(cmd.total_calls)::INTEGER AS total_calls,
    SUM(cmd.inbound_calls)::INTEGER AS inbound_calls,
    SUM(cmd.outbound_calls)::INTEGER AS outbound_calls,
    SUM(cmd.answered_calls)::INTEGER AS answered_calls,
    SUM(cmd.missed_calls)::INTEGER AS missed_calls,
    SUM(cmd.total_talk_seconds)::INTEGER AS total_talk_seconds,
    COUNT(DISTINCT cmd.team_member_id)::INTEGER AS team_member_count
  FROM call_metrics_daily cmd
  WHERE cmd.agency_id = v_agency_id
    AND cmd.date BETWEEN p_start_date AND p_end_date
  GROUP BY cmd.date
  ORDER BY cmd.date DESC;
END;
$$;

-- 3. Get contact activities for a contact or agency
CREATE OR REPLACE FUNCTION get_contact_activities(
  p_team_member_id UUID,
  p_contact_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  contact_id UUID,
  source_module TEXT,
  activity_type TEXT,
  activity_subtype TEXT,
  phone_number TEXT,
  call_direction TEXT,
  call_duration_seconds INTEGER,
  subject TEXT,
  notes TEXT,
  outcome TEXT,
  created_by_display_name TEXT,
  created_at TIMESTAMPTZ,
  call_event_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Validate team member exists and get agency_id
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Invalid team member ID';
  END IF;

  -- Validate caller has access to this agency
  IF NOT has_agency_access(auth.uid(), v_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to this agency data';
  END IF;

  RETURN QUERY
  SELECT
    ca.id,
    ca.contact_id,
    ca.source_module,
    ca.activity_type,
    ca.activity_subtype,
    ca.phone_number,
    ca.call_direction,
    ca.call_duration_seconds,
    ca.subject,
    ca.notes,
    ca.outcome,
    ca.created_by_display_name,
    ca.created_at,
    ca.call_event_id
  FROM contact_activities ca
  WHERE ca.agency_id = v_agency_id
    AND (p_contact_id IS NULL OR ca.contact_id = p_contact_id)
  ORDER BY ca.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. Get call events for the agency
CREATE OR REPLACE FUNCTION get_call_events(
  p_team_member_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_direction TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  external_call_id TEXT,
  provider TEXT,
  direction TEXT,
  call_type TEXT,
  from_number TEXT,
  to_number TEXT,
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  result TEXT,
  extension_id TEXT,
  extension_name TEXT,
  matched_team_member_id UUID,
  matched_prospect_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Validate team member exists and get agency_id
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Invalid team member ID';
  END IF;

  -- Validate caller has access to this agency
  IF NOT has_agency_access(auth.uid(), v_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to this agency data';
  END IF;

  RETURN QUERY
  SELECT
    ce.id,
    ce.external_call_id,
    ce.provider,
    ce.direction,
    ce.call_type,
    ce.from_number,
    ce.to_number,
    ce.call_started_at,
    ce.call_ended_at,
    ce.duration_seconds,
    ce.result,
    ce.extension_id,
    ce.extension_name,
    ce.matched_team_member_id,
    ce.matched_prospect_id,
    ce.created_at
  FROM call_events ce
  WHERE ce.agency_id = v_agency_id
    AND ce.call_started_at BETWEEN p_start_date AND p_end_date
    AND (p_direction IS NULL OR ce.direction = p_direction)
  ORDER BY ce.call_started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 5. Get VOIP integration status for the agency
CREATE OR REPLACE FUNCTION get_agency_voip_status(
  p_team_member_id UUID
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  is_active BOOLEAN,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Validate team member exists and get agency_id
  SELECT agency_id INTO v_agency_id
  FROM team_members
  WHERE id = p_team_member_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Invalid team member ID';
  END IF;

  -- Validate caller has access to this agency
  IF NOT has_agency_access(auth.uid(), v_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied to this agency data';
  END IF;

  RETURN QUERY
  SELECT
    vi.id,
    vi.provider,
    vi.is_active,
    vi.last_sync_at,
    vi.last_sync_error,
    vi.created_at,
    vi.updated_at
  FROM voip_integrations vi
  WHERE vi.agency_id = v_agency_id;
END;
$$;
