-- Canonical owner/admin sale write path.
-- Moves owner manual sale creation, owner PDF sale creation, and owner edits
-- into a single server-side transactional function so the browser no longer
-- orchestrates sales/sale_policies/sale_items/LQS linkage itself.

CREATE OR REPLACE FUNCTION public.upsert_admin_sale_transaction(
  p_user_id uuid,
  p_agency_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid := NULLIF(p_payload->>'sale_id', '')::uuid;
  v_is_update boolean := v_sale_id IS NOT NULL;
  v_sale_source text := COALESCE(NULLIF(btrim(p_payload->>'source'), ''), 'manual');
  v_sale_source_details jsonb := CASE
    WHEN p_payload ? 'source_details' THEN p_payload->'source_details'
    ELSE NULL
  END;
  v_customer_name text := btrim(COALESCE(p_payload->>'customer_name', ''));
  v_customer_email text := NULLIF(btrim(COALESCE(p_payload->>'customer_email', '')), '');
  v_customer_phone text := NULLIF(btrim(COALESCE(p_payload->>'customer_phone', '')), '');
  v_customer_zip text := NULLIF(btrim(COALESCE(p_payload->>'customer_zip', '')), '');
  v_sale_date date := NULLIF(p_payload->>'sale_date', '')::date;
  v_effective_date date := NULLIF(p_payload->>'effective_date', '')::date;
  v_expiration_date date := NULLIF(p_payload->>'expiration_date', '')::date;
  v_lead_source_id uuid := NULLIF(p_payload->>'lead_source_id', '')::uuid;
  v_prior_insurance_company_id uuid := NULLIF(p_payload->>'prior_insurance_company_id', '')::uuid;
  v_sale_level_brokered_carrier_id uuid := NULLIF(p_payload->>'brokered_carrier_id', '')::uuid;
  v_requested_household_id uuid := NULLIF(p_payload->>'household_id', '')::uuid;
  v_requested_team_member_id uuid := NULLIF(p_payload->>'team_member_id', '')::uuid;
  v_final_team_member_id uuid := v_requested_team_member_id;
  v_existing_household_id uuid;
  v_existing_household_count integer := 0;
  v_household_id uuid;
  v_contact_id uuid;
  v_owner_team_member_id uuid;
  v_duplicate_policy_number text;
  v_duplicate_sale_id uuid;
  v_duplicate_sale_source text;
  v_duplicate_customer_name text;
  v_duplicate_sale_date date;
  v_first_name text;
  v_last_name text;
  v_name_parts text[];
  v_household_key text;
  v_policy jsonb;
  v_item jsonb;
  v_policy_id uuid;
  v_policy_total_items integer;
  v_policy_total_premium numeric;
  v_policy_total_points integer;
  v_inserted_policy_count integer := 0;
  v_linked_lqs_sale_count integer := 0;
  v_lead_source_name text;
  v_total_policies integer := COALESCE(NULLIF(p_payload->>'total_policies', '')::integer, 0);
  v_total_items integer := COALESCE(NULLIF(p_payload->>'total_items', '')::integer, 0);
  v_total_premium numeric := COALESCE(NULLIF(p_payload->>'total_premium', '')::numeric, 0);
  v_total_points integer := COALESCE(NULLIF(p_payload->>'total_points', '')::integer, 0);
  v_is_vc_qualifying boolean := COALESCE((p_payload->>'is_vc_qualifying')::boolean, false);
  v_vc_items integer := COALESCE(NULLIF(p_payload->>'vc_items', '')::integer, 0);
  v_vc_premium numeric := COALESCE(NULLIF(p_payload->>'vc_premium', '')::numeric, 0);
  v_vc_points integer := COALESCE(NULLIF(p_payload->>'vc_points', '')::integer, 0);
  v_is_bundle boolean := COALESCE((p_payload->>'is_bundle')::boolean, false);
  v_bundle_type text := NULLIF(btrim(COALESCE(p_payload->>'bundle_type', '')), '');
  v_existing_customer_products text[] := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(p_payload->'existing_customer_products', '[]'::jsonb))
  );
  v_brokered_counts_toward_bundling boolean := COALESCE((p_payload->>'brokered_counts_toward_bundling')::boolean, false);
  v_is_one_call_close boolean := COALESCE((p_payload->>'is_one_call_close')::boolean, false);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required';
  END IF;

  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'Agency is required';
  END IF;

  IF v_customer_name = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF v_sale_date IS NULL THEN
    RAISE EXCEPTION 'Sale date is required';
  END IF;

  IF v_effective_date IS NULL THEN
    RAISE EXCEPTION 'Effective date is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload->'policies', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_payload->'policies', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one policy is required';
  END IF;

  IF v_is_update THEN
    PERFORM 1
    FROM public.sales
    WHERE id = v_sale_id
      AND agency_id = p_agency_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sale not found for this agency';
    END IF;

    SELECT COUNT(DISTINCT household_id)
      INTO v_existing_household_count
    FROM public.lqs_sales
    WHERE agency_id = p_agency_id
      AND source_reference_id = v_sale_id;

    SELECT household_id
      INTO v_existing_household_id
    FROM public.lqs_sales
    WHERE agency_id = p_agency_id
      AND source_reference_id = v_sale_id
    ORDER BY household_id::text
    LIMIT 1;

    IF v_existing_household_count > 1 THEN
      RAISE EXCEPTION 'Sale is linked to multiple LQS households and requires manual review';
    END IF;
  END IF;

  IF v_final_team_member_id IS NOT NULL THEN
    PERFORM 1
    FROM public.team_members
    WHERE id = v_final_team_member_id
      AND agency_id = p_agency_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected producer does not belong to this agency';
    END IF;
  ELSIF v_sale_source = 'manual' THEN
    SELECT id
      INTO v_owner_team_member_id
    FROM public.team_members
    WHERE agency_id = p_agency_id
      AND role = 'Owner'
      AND status = 'active'
    ORDER BY created_at
    LIMIT 1;

    v_final_team_member_id := v_owner_team_member_id;
  END IF;

  SELECT
    incoming.policy_number,
    sp.sale_id,
    s.source,
    s.customer_name,
    s.sale_date
  INTO
    v_duplicate_policy_number,
    v_duplicate_sale_id,
    v_duplicate_sale_source,
    v_duplicate_customer_name,
    v_duplicate_sale_date
  FROM (
    SELECT DISTINCT NULLIF(btrim(policy->>'policy_number'), '') AS policy_number
    FROM jsonb_array_elements(COALESCE(p_payload->'policies', '[]'::jsonb)) policy
  ) incoming
  JOIN public.sale_policies sp
    ON sp.policy_number = incoming.policy_number
  JOIN public.sales s
    ON s.id = sp.sale_id
  WHERE incoming.policy_number IS NOT NULL
    AND s.agency_id = p_agency_id
    AND (NOT v_is_update OR sp.sale_id <> v_sale_id)
  LIMIT 1;

  IF v_duplicate_sale_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Policy % already exists for % on %.',
      v_duplicate_policy_number,
      COALESCE(v_duplicate_customer_name, 'Unknown customer'),
      COALESCE(to_char(v_duplicate_sale_date, 'Mon DD, YYYY'), 'an unknown date');
  END IF;

  BEGIN
    v_name_parts := regexp_split_to_array(v_customer_name, '\s+');
    v_last_name := btrim(v_name_parts[array_length(v_name_parts, 1)]);
    IF v_last_name = '' THEN
      v_last_name := v_customer_name;
    END IF;

    IF array_length(v_name_parts, 1) > 1 THEN
      v_first_name := btrim(array_to_string(v_name_parts[1:array_length(v_name_parts, 1) - 1], ' '));
    ELSE
      v_first_name := v_last_name;
    END IF;

    IF v_first_name = '' THEN
      v_first_name := v_last_name;
    END IF;

    SELECT public.find_or_create_contact(
      p_agency_id,
      v_first_name,
      v_last_name,
      v_customer_zip,
      v_customer_phone,
      v_customer_email
    ) INTO v_contact_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_contact_id := NULL;
  END;

  IF v_is_update THEN
    UPDATE public.sales
    SET
      team_member_id = v_final_team_member_id,
      lead_source_id = v_lead_source_id,
      prior_insurance_company_id = v_prior_insurance_company_id,
      brokered_carrier_id = v_sale_level_brokered_carrier_id,
      customer_name = v_customer_name,
      customer_email = v_customer_email,
      customer_phone = v_customer_phone,
      customer_zip = v_customer_zip,
      sale_date = v_sale_date,
      effective_date = v_effective_date,
      expiration_date = v_expiration_date,
      total_policies = v_total_policies,
      total_items = v_total_items,
      total_premium = v_total_premium,
      total_points = v_total_points,
      is_vc_qualifying = v_is_vc_qualifying,
      vc_items = v_vc_items,
      vc_premium = v_vc_premium,
      vc_points = v_vc_points,
      is_bundle = v_is_bundle,
      bundle_type = v_bundle_type,
      existing_customer_products = v_existing_customer_products,
      brokered_counts_toward_bundling = v_brokered_counts_toward_bundling,
      is_one_call_close = v_is_one_call_close,
      source = v_sale_source,
      source_details = v_sale_source_details,
      contact_id = COALESCE(contact_id, v_contact_id),
      updated_at = now()
    WHERE id = v_sale_id
      AND agency_id = p_agency_id;

    DELETE FROM public.lqs_sales
    WHERE agency_id = p_agency_id
      AND source_reference_id = v_sale_id;

    DELETE FROM public.sale_items
    WHERE sale_id = v_sale_id;

    DELETE FROM public.sale_policies
    WHERE sale_id = v_sale_id;
  ELSE
    INSERT INTO public.sales (
      agency_id,
      team_member_id,
      contact_id,
      lead_source_id,
      prior_insurance_company_id,
      brokered_carrier_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_zip,
      sale_date,
      effective_date,
      expiration_date,
      total_policies,
      total_items,
      total_premium,
      total_points,
      is_vc_qualifying,
      vc_items,
      vc_premium,
      vc_points,
      is_bundle,
      bundle_type,
      existing_customer_products,
      brokered_counts_toward_bundling,
      is_one_call_close,
      source,
      source_details,
      created_by
    ) VALUES (
      p_agency_id,
      v_final_team_member_id,
      v_contact_id,
      v_lead_source_id,
      v_prior_insurance_company_id,
      v_sale_level_brokered_carrier_id,
      v_customer_name,
      v_customer_email,
      v_customer_phone,
      v_customer_zip,
      v_sale_date,
      v_effective_date,
      v_expiration_date,
      v_total_policies,
      v_total_items,
      v_total_premium,
      v_total_points,
      v_is_vc_qualifying,
      v_vc_items,
      v_vc_premium,
      v_vc_points,
      v_is_bundle,
      v_bundle_type,
      v_existing_customer_products,
      v_brokered_counts_toward_bundling,
      v_is_one_call_close,
      v_sale_source,
      v_sale_source_details,
      p_user_id
    )
    RETURNING id INTO v_sale_id;
  END IF;

  FOR v_policy IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_payload->'policies', '[]'::jsonb))
  LOOP
    IF jsonb_typeof(COALESCE(v_policy->'items', 'null'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(v_policy->'items', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Each policy must have at least one line item';
    END IF;

    SELECT
      COALESCE(SUM(COALESCE(NULLIF(item->>'item_count', '')::integer, 0)), 0),
      COALESCE(SUM(COALESCE(NULLIF(item->>'premium', '')::numeric, 0)), 0),
      COALESCE(SUM(COALESCE(NULLIF(item->>'points', '')::integer, 0)), 0)
    INTO
      v_policy_total_items,
      v_policy_total_premium,
      v_policy_total_points
    FROM jsonb_array_elements(COALESCE(v_policy->'items', '[]'::jsonb)) item;

    INSERT INTO public.sale_policies (
      sale_id,
      product_type_id,
      policy_type_name,
      policy_number,
      effective_date,
      expiration_date,
      total_items,
      total_premium,
      total_points,
      is_vc_qualifying,
      brokered_carrier_id
    ) VALUES (
      v_sale_id,
      NULLIF(v_policy->>'product_type_id', '')::uuid,
      COALESCE(NULLIF(btrim(v_policy->>'policy_type_name'), ''), 'Unknown'),
      NULLIF(btrim(COALESCE(v_policy->>'policy_number', '')), ''),
      COALESCE(NULLIF(v_policy->>'effective_date', '')::date, v_effective_date),
      NULLIF(v_policy->>'expiration_date', '')::date,
      v_policy_total_items,
      v_policy_total_premium,
      v_policy_total_points,
      COALESCE((v_policy->>'is_vc_qualifying')::boolean, false),
      NULLIF(v_policy->>'brokered_carrier_id', '')::uuid
    )
    RETURNING id INTO v_policy_id;

    v_inserted_policy_count := v_inserted_policy_count + 1;

    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_policy->'items', '[]'::jsonb))
    LOOP
      INSERT INTO public.sale_items (
        sale_id,
        sale_policy_id,
        product_type_id,
        product_type_name,
        item_count,
        premium,
        points,
        is_vc_qualifying
      ) VALUES (
        v_sale_id,
        v_policy_id,
        NULLIF(v_item->>'product_type_id', '')::uuid,
        COALESCE(NULLIF(btrim(v_item->>'product_type_name'), ''), COALESCE(NULLIF(btrim(v_policy->>'policy_type_name'), ''), 'Unknown')),
        COALESCE(NULLIF(v_item->>'item_count', '')::integer, 0),
        COALESCE(NULLIF(v_item->>'premium', '')::numeric, 0),
        COALESCE(NULLIF(v_item->>'points', '')::integer, 0),
        COALESCE((v_item->>'is_vc_qualifying')::boolean, false)
      );
    END LOOP;
  END LOOP;

  IF v_requested_household_id IS NOT NULL THEN
    SELECT id
      INTO v_household_id
    FROM public.lqs_households
    WHERE id = v_requested_household_id
      AND agency_id = p_agency_id;

    IF v_household_id IS NULL THEN
      RAISE EXCEPTION 'Selected LQS household does not belong to this agency';
    END IF;
  END IF;

  IF v_household_id IS NULL AND v_existing_household_id IS NOT NULL THEN
    v_household_id := v_existing_household_id;
  END IF;

  IF v_household_id IS NULL THEN
    SELECT household_id
      INTO v_household_id
    FROM public.match_sale_to_lqs_household(v_sale_id)
    LIMIT 1;
  END IF;

  IF v_household_id IS NULL AND v_customer_phone IS NOT NULL THEN
    SELECT h.id
      INTO v_household_id
    FROM public.lqs_households h
    WHERE h.agency_id = p_agency_id
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(h.phone, ARRAY[]::text[])) AS phone_value
        WHERE right(regexp_replace(phone_value, '\D', '', 'g'), 10) =
              right(regexp_replace(v_customer_phone, '\D', '', 'g'), 10)
      )
    LIMIT 1;
  END IF;

  IF v_household_id IS NULL THEN
    v_household_key := public.generate_household_key(v_first_name, v_last_name, v_customer_zip);

    SELECT id
      INTO v_household_id
    FROM public.lqs_households
    WHERE agency_id = p_agency_id
      AND household_key = v_household_key
    LIMIT 1;

    IF v_household_id IS NULL THEN
      INSERT INTO public.lqs_households (
        agency_id,
        household_key,
        first_name,
        last_name,
        zip_code,
        phone,
        email,
        lead_source_id,
        prior_insurance_company_id,
        lead_received_date,
        status,
        team_member_id,
        contact_id,
        needs_attention
      ) VALUES (
        p_agency_id,
        v_household_key,
        v_first_name,
        v_last_name,
        COALESCE(NULLIF(left(COALESCE(v_customer_zip, ''), 5), ''), NULL),
        CASE WHEN v_customer_phone IS NOT NULL THEN ARRAY[v_customer_phone] ELSE NULL END,
        v_customer_email,
        v_lead_source_id,
        v_prior_insurance_company_id,
        v_sale_date,
        'lead',
        v_final_team_member_id,
        v_contact_id,
        false
      )
      RETURNING id INTO v_household_id;
    END IF;
  END IF;

  UPDATE public.lqs_households
  SET
    team_member_id = COALESCE(v_final_team_member_id, team_member_id),
    lead_source_id = COALESCE(v_lead_source_id, lead_source_id),
    prior_insurance_company_id = COALESCE(v_prior_insurance_company_id, prior_insurance_company_id),
    zip_code = COALESCE(NULLIF(left(COALESCE(v_customer_zip, ''), 5), ''), zip_code),
    contact_id = COALESCE(v_contact_id, contact_id),
    phone = CASE
      WHEN v_customer_phone IS NOT NULL THEN ARRAY[v_customer_phone]
      ELSE phone
    END,
    email = COALESCE(v_customer_email, email),
    needs_attention = false,
    updated_at = now()
  WHERE id = v_household_id
    AND agency_id = p_agency_id;

  PERFORM public.link_sale_to_lqs_household(v_household_id, v_sale_id);

  SELECT COUNT(*)
    INTO v_linked_lqs_sale_count
  FROM public.lqs_sales
  WHERE agency_id = p_agency_id
    AND source_reference_id = v_sale_id;

  IF v_linked_lqs_sale_count < v_inserted_policy_count THEN
    FOR v_policy_id IN
      SELECT sp.id
      FROM public.sale_policies sp
      WHERE sp.sale_id = v_sale_id
    LOOP
      UPDATE public.lqs_sales ls
      SET
        source_reference_id = v_sale_id,
        team_member_id = COALESCE(v_final_team_member_id, ls.team_member_id),
        is_one_call_close = v_is_one_call_close
      WHERE ls.id = (
        SELECT candidate.id
        FROM public.sale_policies sp
        JOIN public.lqs_sales candidate
          ON candidate.agency_id = p_agency_id
         AND candidate.household_id = v_household_id
         AND candidate.sale_date = v_sale_date
         AND candidate.source_reference_id IS NULL
         AND public.normalize_product_type(candidate.product_type) = public.normalize_product_type(sp.policy_type_name)
         AND COALESCE(candidate.premium_cents, 0) = ROUND(COALESCE(sp.total_premium, 0) * 100)
         AND COALESCE(candidate.policy_number, '') = COALESCE(sp.policy_number, '')
        WHERE sp.id = v_policy_id
        LIMIT 1
      );
    END LOOP;

    SELECT COUNT(*)
      INTO v_linked_lqs_sale_count
    FROM public.lqs_sales
    WHERE agency_id = p_agency_id
      AND source_reference_id = v_sale_id;
  END IF;

  IF v_linked_lqs_sale_count < v_inserted_policy_count THEN
    RAISE EXCEPTION 'Failed to link every policy to LQS';
  END IF;

  SELECT name
    INTO v_lead_source_name
  FROM public.lead_sources
  WHERE id = v_lead_source_id;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'is_update', v_is_update,
    'household_id', v_household_id,
    'policy_count', v_inserted_policy_count,
    'linked_lqs_sale_count', v_linked_lqs_sale_count,
    'lead_source_id', v_lead_source_id,
    'lead_source_name', v_lead_source_name
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_admin_sale_transaction(uuid, uuid, jsonb)
IS 'Canonical transactional owner/admin sale upsert used by manual sale and PDF upload flows.';

REVOKE ALL ON FUNCTION public.upsert_admin_sale_transaction(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_admin_sale_transaction(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_admin_sale_transaction(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_admin_sale_transaction(uuid, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
