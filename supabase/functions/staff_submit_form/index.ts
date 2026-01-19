// STAFF FORM SUBMIT - REQUIRES STAFF SESSION AUTH
// team_member_id derived from session, NOT from request body
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const FUNCTION_VERSION = "1.0.0";

// Date validation - ensure work date is within 7 days
function validateWorkDate(workDate: string): { valid: boolean; error?: string } {
  const submitted = new Date(workDate + 'T12:00:00Z');
  const now = new Date();
  const daysDiff = Math.abs((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 7) {
    return {
      valid: false,
      error: `Work date must be within 7 days of today. You submitted for ${workDate} but today is ${now.toISOString().split('T')[0]}.`
    };
  }
  return { valid: true };
}

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
        error: 'staff_not_linked',
        message: 'Your account is not connected to a team member profile.',
        action: 'Ask your manager to link your account in Team Settings.'
      });
    }

    logStructured('info', 'staff_verified', {
      request_id: requestId,
      staff_user_id: staffUser.id,
      team_member_id: staffUser.team_member_id,
      agency_id: staffUser.agency_id
    });

    // Step 4: Resolve form template by slug
    const { formSlug, submissionDate, workDate, values, schemaVersion } = body;

    if (!formSlug || !submissionDate) {
      return json(400, { error: 'formSlug and submissionDate are required' });
    }

    // 1A: Date validation - ensure work date is within 7 days
    const effectiveDateForValidation = workDate || submissionDate;
    const dateCheck = validateWorkDate(effectiveDateForValidation);
    if (!dateCheck.valid) {
      return json(400, {
        error: 'invalid_work_date',
        message: dateCheck.error
      });
    }

    const { data: template, error: templateError } = await supabase
      .from('form_templates')
      .select('id, slug, status, agency_id, name, needs_attention, form_kpi_version')
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

    // 1B: Schema version validation - detect if form was updated while user had it open
    if (schemaVersion && template.form_kpi_version && template.form_kpi_version > schemaVersion) {
      return json(409, {
        error: 'form_schema_changed',
        message: 'This form was updated while you had it open. Please refresh and try again.',
        client_version: schemaVersion,
        current_version: template.form_kpi_version
      });
    }

    // LAYER 4: Block submissions for forms that need admin attention
    if (template.needs_attention) {
      logStructured('warn', 'form_needs_attention_blocked', {
        request_id: requestId,
        form_template_id: template.id,
        form_name: template.name
      });
      return json(400, { 
        error: `The "${template.name}" form has a configuration issue. One or more KPIs used in this form were recently deleted or modified by a manager. Your manager needs to open this form in the Form Editor and update the KPI settings before you can submit. Please let them know so they can fix it.`,
        error_code: 'FORM_NEEDS_ATTENTION',
        form_name: template.name
      });
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

    // Enrich soldDetails with lead_source_label
    if (Array.isArray(v.soldDetails)) {
      for (const sold of v.soldDetails) {
        const id = sold.lead_source_id ?? sold.lead_source;
        if (id && !sold.lead_source_label) {
          const { data: ls } = await supabase
            .from('lead_sources')
            .select('id,name')
            .eq('id', id)
            .single();
          if (ls) {
            sold.lead_source_id = ls.id;
            sold.lead_source_label = ls.name;
            delete sold.lead_source;
          }
        }
      }
    }

    // Step 6: Resolve active KPI binding (with slug-based fallback)
    let kpiVersionId: string | null = null;
    let labelAtSubmit: string | null = null;

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

    if (!bindingError && kpiBindings && kpiBindings.length > 0) {
      // Use bindings if available
      // Note: kpi_versions is returned as array from joined query
      kpiVersionId = kpiBindings[0].kpi_version_id;
      labelAtSubmit = kpiBindings[0].kpi_versions?.[0]?.label || null;
    } else {
      // Fallback: Try to resolve KPIs by slug from form schema
      logStructured('info', 'attempting_slug_fallback', {
        request_id: requestId,
        form_template_id: template.id
      });

      // Get form schema to extract KPI slugs
      const { data: formTemplate } = await supabase
        .from('form_templates')
        .select('schema_json')
        .eq('id', template.id)
        .single();

      if (formTemplate?.schema_json) {
        const schema = formTemplate.schema_json as any;
        const kpiSlugs = (schema.kpis || [])
          .filter((k: any) => k.selectedKpiSlug)
          .map((k: any) => k.selectedKpiSlug);

        if (kpiSlugs.length > 0) {
          // Look up current active KPI versions by slug
          const { data: slugResolved } = await supabase
            .from('kpis')
            .select(`
              id, 
              slug,
              kpi_versions!inner (
                id,
                label,
                valid_to
              )
            `)
            .eq('agency_id', staffUser.agency_id)
            .eq('is_active', true)
            .in('slug', kpiSlugs)
            .is('kpi_versions.valid_to', null);

          if (slugResolved && slugResolved.length > 0) {
            const firstMatch = slugResolved[0];
            kpiVersionId = firstMatch.kpi_versions[0]?.id;
            labelAtSubmit = firstMatch.kpi_versions[0]?.label;
            
            logStructured('info', 'slug_fallback_success', {
              request_id: requestId,
              resolved_kpis: slugResolved.map(k => k.slug),
              kpi_version_id: kpiVersionId
            });
          }
        }
      }
    }

    // If still no KPI binding after slug fallback, block with clear error
    if (!kpiVersionId) {
      // Get KPI slugs from schema to show in error message
      const { data: formTemplateSchema } = await supabase
        .from('form_templates')
        .select('schema_json')
        .eq('id', template.id)
        .single();
      
      const schema = formTemplateSchema?.schema_json as any;
      const kpiLabels = (schema?.kpis || [])
        .filter((k: any) => k.selectedKpiSlug)
        .map((k: any) => k.label || k.selectedKpiSlug)
        .join(', ');

      logStructured('error', 'kpi_resolution_failed', {
        request_id: requestId,
        form_template_id: template.id,
        kpi_labels: kpiLabels
      });

      return json(400, { 
        error: `Cannot submit "${template.name}" - the following KPIs are missing or have been deleted: ${kpiLabels || 'unknown KPIs'}. Your manager needs to open this form in the Form Editor and update the KPI settings. Please let them know so they can fix it.`,
        error_code: 'MISSING_KPIS',
        form_name: template.name,
        missing_kpis: kpiLabels
      });
    }

    // Step 7: Insert submission (team_member_id from session, NOT request)
    // 1D: Wrap in try-catch to handle unique constraint violations
    let sid: string;
    try {
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
        // Check for unique constraint violation on metrics_daily
        if (insErr.code === '23505' || insErr.message?.includes('unique_member_date')) {
          return json(409, {
            error: 'duplicate_submission',
            message: 'A submission already exists for this date.',
            work_date: workDate ?? submissionDate
          });
        }
        logStructured('error', 'submission_insert_failed', {
          request_id: requestId,
          error: insErr.message
        });
        return json(500, { error: 'Failed to create submission' });
      }

      sid = ins.id;

      // Step 8: Finalize submission (same pattern as public form)
      const { data: sRow, error: sRowError } = await supabase
        .from('submissions')
        .select('team_member_id, work_date, submission_date')
        .eq('id', sid)
        .single();

      if (sRowError || !sRow) {
        logStructured('error', 'submission_fetch_failed', {
          request_id: requestId,
          submission_id: sid,
          error: sRowError?.message
        });
        return json(500, { error: 'Submission created but could not be verified' });
      }

      const effectiveWorkDate = sRow.work_date ?? sRow.submission_date;

      // Clear any existing finals for same TM + date
      const { error: clearError } = await supabase
        .from('submissions')
        .update({ final: false })
        .eq('team_member_id', sRow.team_member_id)
        .or(`work_date.eq.${effectiveWorkDate},and(work_date.is.null,submission_date.eq.${effectiveWorkDate})`)
        .eq('final', true);

      if (clearError) {
        logStructured('warn', 'clear_finals_failed', {
          request_id: requestId,
          submission_id: sid,
          error: clearError.message
        });
        // Continue anyway - this isn't fatal, but log it
      }

      // Finalize this submission
      const { error: finalizeError } = await supabase
        .from('submissions')
        .update({ final: true })
        .eq('id', sid);

      if (finalizeError) {
        logStructured('error', 'finalization_failed', {
          request_id: requestId,
          submission_id: sid,
          error: finalizeError.message
        });
        return json(500, {
          error: 'Failed to finalize submission',
          submission_id: sid,
          detail: finalizeError.message
        });
      }

      // VERIFICATION: Re-fetch to confirm final=true (belt and suspenders)
      const { data: verified, error: verifyError } = await supabase
        .from('submissions')
        .select('final')
        .eq('id', sid)
        .single();

      if (verifyError || !verified || verified.final !== true) {
        logStructured('error', 'finalization_verification_failed', {
          request_id: requestId,
          submission_id: sid,
          actual_final: verified?.final,
          verify_error: verifyError?.message
        });
        return json(500, {
          error: 'Submission created but finalization could not be verified. Please try again.',
          submission_id: sid
        });
      }

      logStructured('info', 'finalization_verified', {
        request_id: requestId,
        submission_id: sid,
        final: verified.final
      });
    } catch (error: any) {
      // Check for unique constraint violation on metrics_daily
      if (error?.code === '23505' || error?.message?.includes('unique_member_date')) {
        return json(409, {
          error: 'duplicate_submission',
          message: 'A submission already exists for this date.',
          work_date: workDate ?? submissionDate
        });
      }
      throw error; // Re-throw if not a duplicate error
    }

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
