// STAFF FORM SUBMIT - REQUIRES STAFF SESSION AUTH
// team_member_id derived from session, NOT from request body
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const FUNCTION_VERSION = "1.0.0";

function logStructured(level: 'info' | 'warn' | 'error', eventType: string, data: Record<string, any>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    function_version: FUNCTION_VERSION,
    ...data
  };
  
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  } else {
    console.info(`[${level.toUpperCase()}] ${eventType}:`, JSON.stringify(logEntry));
  }
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const sessionToken = req.headers.get('x-staff-session') || body.sessionToken;

    logStructured('info', 'staff_submit_start', {
      request_id: requestId,
      form_slug: body.formSlug,
      has_session: !!sessionToken
    });

    // Step 1: Validate session token
    if (!sessionToken) {
      logStructured('warn', 'missing_session', { request_id: requestId });
      return json(401, { error: 'Session token required' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      logStructured('warn', 'session_not_found', { request_id: requestId });
      return json(401, { error: 'Invalid session' });
    }

    if (!session.is_valid || new Date(session.expires_at) < new Date()) {
      logStructured('warn', 'session_expired', { 
        request_id: requestId,
        expires_at: session.expires_at,
        is_valid: session.is_valid
      });
      return json(401, { error: 'Session expired. Please log in again.' });
    }

    // Step 2: Get staff user with team_member_id
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, team_member_id, agency_id, display_name')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      logStructured('error', 'staff_user_not_found', { 
        request_id: requestId,
        staff_user_id: session.staff_user_id
      });
      return json(500, { error: 'Staff user not found' });
    }

    // Step 3: Verify staff is linked to a team member (SECURITY CRITICAL)
    if (!staffUser.team_member_id) {
      logStructured('warn', 'staff_not_linked', { 
        request_id: requestId,
        staff_user_id: staffUser.id
      });
      return json(403, { 
        error: 'Staff user not linked to a team member. Please contact your administrator.' 
      });
    }

    logStructured('info', 'staff_verified', {
      request_id: requestId,
      staff_user_id: staffUser.id,
      team_member_id: staffUser.team_member_id,
      agency_id: staffUser.agency_id
    });

    // Step 4: Resolve form template by slug
    const { formSlug, submissionDate, workDate, values } = body;

    if (!formSlug || !submissionDate) {
      return json(400, { error: 'formSlug and submissionDate are required' });
    }

    const { data: template, error: templateError } = await supabase
      .from('form_templates')
      .select('id, slug, status, agency_id')
      .eq('slug', formSlug)
      .eq('agency_id', staffUser.agency_id)
      .single();

    if (templateError || !template) {
      logStructured('warn', 'template_not_found', {
        request_id: requestId,
        form_slug: formSlug,
        agency_id: staffUser.agency_id
      });
      return json(404, { error: 'Form not found' });
    }

    if (template.status !== 'published') {
      return json(403, { error: 'Form is not published' });
    }

    // Step 5: Normalize payload (same as public form)
    const v = { ...values };
    
    // Strip preselected_kpi_N_<slug> -> <slug>
    for (const key of Object.keys(v)) {
      if (/^preselected_kpi_\d+_/.test(key)) {
        const nk = key.replace(/^preselected_kpi_\d+_/, '');
        v[nk] = v[key];
        delete v[key];
      }
    }

    // FIRST: quotedDetails -> quoted_details (normalize key BEFORE enrichment)
    if (Array.isArray(values?.quotedDetails)) {
      v.quoted_details = values.quotedDetails;
      delete v.quotedDetails;
    }

    // THEN: Enrich quoted_details with lead_source_label
    if (Array.isArray(v.quoted_details)) {
      for (const r of v.quoted_details) {
        const id = r.lead_source_id ?? r.lead_source;
        if (id && !r.lead_source_label) {
          const { data: ls } = await supabase
            .from('lead_sources')
            .select('id,name')
            .eq('id', id)
            .single();
          if (ls) {
            r.lead_source_id = ls.id;
            r.lead_source_label = ls.name;
            delete r.lead_source;
          }
        }
      }
    }

    // Step 6: Resolve active KPI binding
    const { data: kpiBindings, error: bindingError } = await supabase
      .from('forms_kpi_bindings')
      .select(`
        kpi_version_id,
        kpi_versions!inner (
          id,
          label,
          valid_to
        )
      `)
      .eq('form_template_id', template.id)
      .is('kpi_versions.valid_to', null);

    if (bindingError || !kpiBindings || kpiBindings.length === 0) {
      logStructured('warn', 'no_active_kpi_binding', {
        request_id: requestId,
        form_template_id: template.id
      });
      return json(400, { error: 'Form has no active KPI bindings' });
    }

    const kpiVersionId = kpiBindings[0].kpi_version_id;
    const labelAtSubmit = kpiBindings[0].kpi_versions.label;

    // Step 7: Insert submission (team_member_id from session, NOT request)
    const { data: ins, error: insErr } = await supabase
      .from('submissions')
      .insert({
        form_template_id: template.id,
        team_member_id: staffUser.team_member_id, // SECURE: from session
        submission_date: submissionDate,
        work_date: workDate ?? null,
        late: false,
        final: false,
        payload_json: v
      })
      .select('id')
      .single();

    if (insErr) {
      logStructured('error', 'submission_insert_failed', {
        request_id: requestId,
        error: insErr.message
      });
      return json(500, { error: 'Failed to create submission' });
    }

    const sid = ins.id;

    // Step 8: Finalize submission (same pattern as public form)
    const { data: sRow } = await supabase
      .from('submissions')
      .select('team_member_id, work_date, submission_date')
      .eq('id', sid)
      .single();
    
    const effectiveWorkDate = sRow.work_date ?? sRow.submission_date;

    // Clear any existing finals for same TM + date
    await supabase
      .from('submissions')
      .update({ final: false })
      .eq('team_member_id', sRow.team_member_id)
      .or(`work_date.eq.${effectiveWorkDate},and(work_date.is.null,submission_date.eq.${effectiveWorkDate})`)
      .eq('final', true);

    // Finalize this submission
    await supabase
      .from('submissions')
      .update({ final: true })
      .eq('id', sid);

    // Background: Flatten quoted_household_details
    if (Array.isArray(v.quoted_details) && v.quoted_details.length > 0) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            await supabase.rpc('flatten_quoted_household_details_enhanced', {
              p_submission_id: sid
            });
            logStructured('info', 'flatten_complete', {
              request_id: requestId,
              submission_id: sid
            });
          } catch (e) {
            logStructured('error', 'flatten_failed', {
              request_id: requestId,
              submission_id: sid,
              error: e instanceof Error ? e.message : String(e)
            });
          }
        })()
      );
    }

    // Trigger feedback email (fire and forget)
    EdgeRuntime.waitUntil(
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send_submission_feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submissionId: sid }),
      }).catch(err => console.error('Failed to trigger feedback email:', err))
    );

    logStructured('info', 'staff_submission_success', {
      request_id: requestId,
      submission_id: sid,
      team_member_id: staffUser.team_member_id,
      staff_user_id: staffUser.id,
      kpi_version_id: kpiVersionId,
      label_at_submit: labelAtSubmit
    });

    return json(200, { 
      success: true,
      submission_id: sid,
      team_member_name: staffUser.display_name
    });

  } catch (e) {
    logStructured('error', 'staff_submit_exception', {
      request_id: requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    });
    return json(500, { 
      error: 'Internal server error',
      message: e instanceof Error ? e.message : String(e)
    });
  }
});
