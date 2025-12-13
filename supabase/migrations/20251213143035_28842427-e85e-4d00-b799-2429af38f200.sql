-- Drop existing function and recreate with correct return type
DROP FUNCTION IF EXISTS public.acknowledge_call_review(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.acknowledge_call_review(
  p_call_id uuid,
  p_team_member_id uuid,
  p_feedback_positive text,
  p_feedback_improvement text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_call_team_member_id uuid;
  v_already_acknowledged boolean;
BEGIN
  -- Verify the call exists and belongs to this team member
  SELECT team_member_id, (acknowledged_at IS NOT NULL)
  INTO v_call_team_member_id, v_already_acknowledged
  FROM agency_calls
  WHERE id = p_call_id;

  IF v_call_team_member_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Call not found');
  END IF;

  IF v_call_team_member_id != p_team_member_id THEN
    RETURN json_build_object('success', false, 'error', 'You can only acknowledge your own calls');
  END IF;

  IF v_already_acknowledged THEN
    RETURN json_build_object('success', false, 'error', 'Call already acknowledged');
  END IF;

  -- Update the call with acknowledgment
  UPDATE agency_calls
  SET 
    acknowledged_at = now(),
    acknowledged_by = p_team_member_id,
    staff_feedback_positive = p_feedback_positive,
    staff_feedback_improvement = p_feedback_improvement
  WHERE id = p_call_id;

  RETURN json_build_object('success', true);
END;
$function$;