-- Phase 3 Batch 2 hardening
-- Constrain Exchange SECURITY DEFINER RPCs to caller identity and conversation membership.

BEGIN;

-- -----------------------------------------------------------------------------
-- search_exchange_users
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_exchange_users(text, uuid);
DROP FUNCTION IF EXISTS public.search_exchange_users(text);

CREATE OR REPLACE FUNCTION public.search_exchange_users(
  search_term text,
  current_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  agency_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Prevent caller spoofing through function parameter.
  IF current_user_id IS NOT NULL AND current_user_id <> v_caller THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    a.name AS agency_name
  FROM profiles p
  LEFT JOIN agencies a ON a.id = p.agency_id
  WHERE p.id <> v_caller
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
    )
  ORDER BY
    CASE WHEN p.full_name ILIKE search_term || '%' THEN 0 ELSE 1 END,
    p.full_name
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.search_exchange_users(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_exchange_users(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_exchange_users(text, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- get_conversation_participants
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_conversation_participants(uuid[]);

CREATE OR REPLACE FUNCTION public.get_conversation_participants(
  participant_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  agency_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    a.name AS agency_name
  FROM profiles p
  LEFT JOIN agencies a ON p.agency_id = a.id
  WHERE p.id = ANY(participant_ids)
    AND (
      p.id = v_caller
      OR EXISTS (
        SELECT 1
        FROM exchange_conversations ec
        WHERE (ec.participant_one = v_caller AND ec.participant_two = p.id)
           OR (ec.participant_two = v_caller AND ec.participant_one = p.id)
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_conversation_participants(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversation_participants(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_participants(uuid[]) TO service_role;

COMMIT;
