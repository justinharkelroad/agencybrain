-- Backfill existing submissions with dashboard quote details from lqs_households.
-- Patches payload_json.quoted_details for submissions that have matching
-- lqs_households records but no quoted_details in their payload.
-- Then re-runs flatten to populate quoted_household_details table.

DO $$
DECLARE
  v_sub RECORD;
  v_details jsonb;
  v_count int := 0;
BEGIN
  FOR v_sub IN
    SELECT
      s.id AS submission_id,
      s.team_member_id,
      COALESCE(s.work_date, s.submission_date) AS work_date,
      ft.agency_id,
      s.payload_json
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
      AND s.team_member_id IS NOT NULL
      AND (
        s.payload_json->'quoted_details' IS NULL
        OR jsonb_typeof(s.payload_json->'quoted_details') != 'array'
        OR jsonb_array_length(s.payload_json->'quoted_details') = 0
      )
      AND EXISTS (
        SELECT 1 FROM lqs_households h
        WHERE h.team_member_id = s.team_member_id
          AND h.agency_id = ft.agency_id
          AND h.first_quote_date = COALESCE(s.work_date, s.submission_date)
          AND h.status IN ('quoted', 'sold')
      )
  LOOP
    -- Build quoted_details array from lqs_households + lqs_quotes
    SELECT COALESCE(jsonb_agg(t.row_detail ORDER BY t.hh_created_at), '[]'::jsonb)
    INTO v_details
    FROM (
      SELECT
        jsonb_build_object(
          'prospect_name', h.first_name || ' ' || h.last_name,
          'lead_source', COALESCE(h.lead_source_id::text, ''),
          'lead_source_label', COALESCE(ls.name, ''),
          'zip_code', COALESCE(h.zip_code, ''),
          'detailed_notes', COALESCE(h.notes, '') ||
            CASE WHEN h.objection_id IS NOT NULL
                 THEN E'\n[Objection: ' || COALESCE(obj.name, 'Unknown') || ']'
                 ELSE '' END,
          'policies_quoted', COALESCE((SELECT count(*) FROM lqs_quotes q WHERE q.household_id = h.id), 0)::int,
          'items_quoted', COALESCE((SELECT sum(q.items_quoted) FROM lqs_quotes q WHERE q.household_id = h.id), 0)::int,
          'premium_potential', ROUND(COALESCE((SELECT sum(q.premium_cents) FROM lqs_quotes q WHERE q.household_id = h.id), 0) / 100.0, 2),
          '_from_dashboard', true,
          '_lqs_household_id', h.id::text
        ) AS row_detail,
        h.created_at AS hh_created_at
      FROM lqs_households h
      LEFT JOIN lqs_objections obj ON obj.id = h.objection_id
      LEFT JOIN lead_sources ls ON ls.id = h.lead_source_id
      WHERE h.team_member_id = v_sub.team_member_id
        AND h.agency_id = v_sub.agency_id
        AND h.first_quote_date = v_sub.work_date
        AND h.status IN ('quoted', 'sold')
    ) t;

    IF jsonb_array_length(v_details) > 0 THEN
      -- Patch payload_json with quoted_details
      UPDATE submissions
      SET payload_json = payload_json || jsonb_build_object('quoted_details', v_details)
      WHERE id = v_sub.submission_id;

      v_count := v_count + 1;

      -- Re-run flatten to populate quoted_household_details table
      PERFORM flatten_quoted_household_details_enhanced(v_sub.submission_id);
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % submissions with dashboard quote details', v_count;
END;
$$;
