// deno-lint-ignore-file no-explicit-any
// PUBLIC FORM SUBMIT - NO AUTH REQUIRED
// TOKEN-BASED VALIDATION ONLY
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "3.9-BACKEND-HARDENING";
const DEPLOYMENT_ID = "deploy-20260117-hardening";

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Gate E: Structured logging helper
function logStructured(level: 'info' | 'warn' | 'error', eventType: string, data: Record<string, any>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    function_version: FUNCTION_VERSION,
    deployment_id: DEPLOYMENT_ID,
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

// Gate E: Friendly error responses
function errorResponse(status: number, errorType: string, errorId?: string) {
  const body = errorId 
    ? { error: errorType, id: errorId }
    : { error: errorType };
    
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...corsHeaders
    }
  });
}

function j(status: number, obj: any) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders
    }
  });
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-function-version": FUNCTION_VERSION,
      ...corsHeaders
    }
  });
}

type Body = {
  agencySlug: string;
  formSlug: string;
  token: string;
  teamMemberId: string;
  submissionDate: string;  // YYYY-MM-DD
  workDate?: string;       // optional
  values: Record<string, unknown>;
  schemaVersion?: number;  // optional - for form schema change detection
};

serve(async (req) => {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  logStructured('info', 'request_start', {
    request_id: requestId,
    method: req.method,
    user_agent: req.headers.get('user-agent'),
    origin: req.headers.get('origin')
  });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logStructured('info', 'cors_preflight', { request_id: requestId });
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      logStructured('warn', 'invalid_method', {
        request_id: requestId,
        method: req.method
      });
      return errorResponse(405, "method_not_allowed");
    }
    
    // Create Supabase client WITHOUT user JWT - public access only
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const body = await req.json() as Body;
    
    logStructured('info', 'request_parsed', {
      request_id: requestId,
      agency_slug: body.agencySlug,
      form_slug: body.formSlug,
      team_member_id: body.teamMemberId,
      submission_date: body.submissionDate,
      work_date: body.workDate,
      has_values: !!body.values
    });
    
    // STRICT PAYLOAD VALIDATION - return 400 not 500
    if (!body.agencySlug || !body.formSlug || !body.token) {
      logStructured('warn', 'validation_failed', {
        request_id: requestId,
        error_type: 'invalid_payload',
        missing_fields: ['agencySlug', 'formSlug', 'token'].filter(f => !body[f as keyof Body])
      });
      return errorResponse(400, "invalid_payload");
    }
    if (!body.teamMemberId || !body.submissionDate) {
      logStructured('warn', 'validation_failed', {
        request_id: requestId,
        error_type: 'invalid_payload',
        missing_fields: ['teamMemberId', 'submissionDate'].filter(f => !body[f as keyof Body])
      });
      return errorResponse(400, "invalid_payload");
    }

    // Date validation - ensure work date is within 7 days
    const effectiveDateForValidation = body.workDate || body.submissionDate;
    const dateCheck = validateWorkDate(effectiveDateForValidation);
    if (!dateCheck.valid) {
      logStructured('warn', 'invalid_work_date', {
        request_id: requestId,
        work_date: body.workDate,
        submission_date: body.submissionDate
      });
      return j(400, {
        error: 'invalid_work_date',
        message: dateCheck.error
      });
    }

    // Build payload
    const raw = (body && body.values) ? body.values : {};
    const v = { ...raw }; // this is the object inserted into payload_json

    // Strip preselected_kpi_N_<slug> -> <slug>
    for (const key of Object.keys(v)) {
      if (/^preselected_kpi_\d+_/.test(key)) {
        const nk = key.replace(/^preselected_kpi_\d+_/, '');
        v[nk] = v[key];
        delete v[key];
      }
    }

    // --- enrich quoted_details with lead_source_label when only an id is provided
    if (Array.isArray(v.quoted_details)) {
      for (const r of v.quoted_details) {
        const id = r.lead_source_id ?? r.lead_source;
        if (id && !r.lead_source_label) {
          const { data: ls } = await supabase
            .from("lead_sources")
            .select("id,name")
            .eq("id", id)
            .single();
          if (ls) {
            r.lead_source_id = ls.id;
            r.lead_source_label = ls.name;
            delete r.lead_source; // keep a single, consistent field
          }
        }
      }
    }

    // quotedDetails -> quoted_details
    if (Array.isArray(raw.quotedDetails)) {
      v.quoted_details = raw.quotedDetails;
      delete v.quotedDetails;
    }

    logStructured('info', 'payload_normalized', {
      request_id: requestId,
      has_quoted_details: Array.isArray(v.quoted_details),
      quoted_details_count: Array.isArray(v.quoted_details) ? v.quoted_details.length : 0
    });

    // TOKEN VALIDATION - public, no user auth required
    // 2A: Better token error handling - distinguish between expired and disabled
    const { data: link, error: linkError } = await supabase
      .from('form_links')
      .select('id, token, enabled, expires_at, form_template_id, agency_id')
      .eq('token', body.token)
      .maybeSingle();

    if (linkError || !link) {
      logStructured('warn', 'token_validation_failed', {
        request_id: requestId,
        token: body.token.substring(0, 8) + '...',
        error: linkError?.message
      });
      return j(401, {
        error: 'token_expired',
        message: 'This form link is invalid or has expired.'
      });
    }

    if (!link.enabled) {
      logStructured('warn', 'token_disabled', {
        request_id: requestId,
        token: body.token.substring(0, 8) + '...'
      });
      return j(401, {
        error: 'token_disabled',
        message: 'This form link has been disabled by your manager.'
      });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      logStructured('warn', 'token_expired', {
        request_id: requestId,
        token: body.token.substring(0, 8) + '...',
        expires_at: link.expires_at
      });
      return j(401, {
        error: 'token_expired',
        message: 'This form link has expired.'
      });
    }

    logStructured('info', 'token_validated', {
      request_id: requestId,
      form_link_id: link.id
    });

    // Get form template
    const { data: template, error: templateError } = await supabase
      .from('form_templates')
      .select('id, slug, status, settings_json, agency_id, form_kpi_version')
      .eq('id', link.form_template_id)
      .single();

    if (templateError || !template) {
      const errorId = crypto.randomUUID();
      logStructured('error', 'template_lookup_failed', {
        request_id: requestId,
        error_id: errorId,
        template_id: link.form_template_id,
        error: templateError?.message
      });
      return errorResponse(500, "internal_error", errorId);
    }

    if (template.status !== 'published') {
      logStructured('warn', 'form_unpublished', {
        request_id: requestId,
        template_id: template.id,
        status: template.status
      });
      return errorResponse(403, "form_unpublished");
    }

    // Schema version validation - detect if form was updated while user had it open
    if (body.schemaVersion && template.form_kpi_version && template.form_kpi_version > body.schemaVersion) {
      logStructured('warn', 'form_schema_changed', {
        request_id: requestId,
        client_version: body.schemaVersion,
        current_version: template.form_kpi_version
      });
      return j(409, {
        error: 'form_schema_changed',
        message: 'This form was updated while you had it open. Please refresh and try again.',
        client_version: body.schemaVersion,
        current_version: template.form_kpi_version
      });
    }

    // Get agency
    const agencyId = link.agency_id || template.agency_id;
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, slug')
      .eq('id', agencyId)
      .single();
      
    if (agencyError || !agency) {
      const errorId = crypto.randomUUID();
      logStructured('error', 'agency_lookup_failed', {
        request_id: requestId,
        error_id: errorId,
        agency_id: agencyId,
        error: agencyError?.message
      });
      return errorResponse(500, "internal_error", errorId);
    }

    // Validate slugs match
    if (template.slug !== body.formSlug || agency.slug !== body.agencySlug) {
      logStructured('warn', 'slug_mismatch', {
        request_id: requestId,
        expected_form: body.formSlug,
        actual_form: template.slug,
        expected_agency: body.agencySlug,
        actual_agency: agency.slug
      });
      return errorResponse(404, "not_found");
    }

    // Compute late status
    const finalDate = body.workDate ?? body.submissionDate;
    const isLate = false; // Simplified for now

    logStructured('info', 'submission_analysis', {
      request_id: requestId,
      agency_slug: agency.slug,
      form_slug: template.slug,
      team_member_id: body.teamMemberId,
      final_date: finalDate,
      is_late: isLate
    });

    // CRITICAL: Resolve active KPI bindings - require valid_to IS NULL
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
      .is('kpi_versions.valid_to', null);  // MUST be active bindings

    // If no active bindings, return 400 (never 500)
    if (bindingError || !kpiBindings || kpiBindings.length === 0) {
      // Get any binding (even expired) for error details
      const { data: anyBindings } = await supabase
        .from('forms_kpi_bindings')
        .select(`
          kpi_version_id,
          kpi_versions!inner (
            id,
            label,
            valid_to
          )
        `)
        .eq('form_template_id', template.id);

      logStructured('warn', 'invalid_kpi_binding', {
        request_id: requestId,
        form_template_id: template.id,
        binding_error: bindingError?.message,
        active_bindings_count: kpiBindings?.length ?? 0
      });
      
      return j(400, { 
        error: "invalid_kpi_binding", 
        form_template_id: template.id, 
        active_bindings_count: kpiBindings?.length ?? 0,
        total_bindings: anyBindings?.length ?? 0,
        sample_binding: anyBindings?.[0] ? {
          kpi_version_id: anyBindings[0].kpi_version_id,
          valid_to: anyBindings[0].kpi_versions?.valid_to
        } : null
      });
    }

    // Use first active binding for metrics (all should be active anyway)
    const kpiVersionId = kpiBindings[0].kpi_version_id;
    const labelAtSubmit = kpiBindings[0].kpi_versions.label;

    logStructured('info', 'active_kpi_binding_resolved', {
      request_id: requestId,
      kpi_version_id: kpiVersionId,
      label_at_submit: labelAtSubmit
    });

    // Step 1: Insert submission with final=false (bypasses trigger)
    // Wrap in try-catch to handle unique constraint violations
    let sid: string;
    try {
      const { data: ins, error: insErr } = await supabase
        .from("submissions")
        .insert({
          form_template_id: template.id,
          team_member_id: body.teamMemberId,
          submission_date: body.submissionDate,
          work_date: body.workDate ?? null,
          late: isLate,
          final: false,  // Critical: start as false to bypass trigger
          payload_json: v // Use normalized values
        })
        .select("id")
        .single();

      if (insErr) {
        // Check for unique constraint violation on metrics_daily
        if (insErr.code === '23505' || insErr.message?.includes('unique_member_date')) {
          return j(409, {
            error: 'duplicate_submission',
            message: 'A submission already exists for this date.',
            work_date: body.workDate ?? body.submissionDate
          });
        }
        const errorId = crypto.randomUUID();
        logStructured('error', 'submission_insert_failed', {
          request_id: requestId,
          error_id: errorId,
          error: insErr.message
        });
        return j(500, { error: "internal_error", id: errorId, message: insErr.message });
      }

      // after the INSERT (which MUST use payload_json: v and final=false)
      sid = ins.id;

      // Use the submission's work_date (or submission_date if work_date is null)
      const { data: sRow } = await supabase
        .from('submissions')
        .select('team_member_id, work_date, submission_date')
        .eq('id', sid)
        .single();
      const workDate = sRow.work_date ?? sRow.submission_date;

      // 1) Clear any existing finals for same TM + date
      await supabase
        .from('submissions')
        .update({ final: false })
        .eq('team_member_id', sRow.team_member_id)
        .or(`work_date.eq.${workDate},and(work_date.is.null,submission_date.eq.${workDate})`)
        .eq('final', true);

      // 2) Finalize this submission (lets trigger fire exactly once)
      await supabase
        .from('submissions')
        .update({ final: true })
        .eq('id', sid);
    } catch (error: any) {
      // Check for unique constraint violation on metrics_daily
      if (error?.code === '23505' || error?.message?.includes('unique_member_date')) {
        return j(409, {
          error: 'duplicate_submission',
          message: 'A submission already exists for this date.',
          work_date: body.workDate ?? body.submissionDate
        });
      }
      throw error; // Re-throw if not a duplicate error
    }

    // Background task: Automatically flatten quoted_household_details
    // This runs asynchronously and doesn't block the response
    if (Array.isArray(v.quoted_details) && v.quoted_details.length > 0) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            logStructured('info', 'flatten_start', {
              request_id: requestId,
              submission_id: sid,
              quoted_details_count: v.quoted_details.length
            });

            const { data: flattenResult, error: flattenError } = await supabase
              .rpc('flatten_quoted_household_details_enhanced', {
                p_submission_id: sid
              });

            if (flattenError) {
              logStructured('error', 'flatten_failed', {
                request_id: requestId,
                submission_id: sid,
                error: flattenError.message
              });
            } else {
              const result = flattenResult as any;
              logStructured('info', 'flatten_complete', {
                request_id: requestId,
                submission_id: sid,
                success: result?.success,
                records_created: result?.records_created
              });
            }
          } catch (e) {
            logStructured('error', 'flatten_exception', {
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

    logStructured('info', 'submission_created', {
      request_id: requestId,
      submission_id: ins.id
    });

    const duration = performance.now() - startTime;

    // Success logging with required artifacts
    logStructured('info', 'submission_success', {
      submission_id: ins.id,
      team_member_id: body.teamMemberId,
      kpi_version_id: kpiVersionId,
      label_at_submit: labelAtSubmit,
      status: 'ok',
      duration_ms: Math.round(duration),
      request_id: requestId
    });

    return j(200, { 
      submission_id: ins.id
    });

  } catch (e) {
    const err_id = crypto.randomUUID();
    // Structured log stays for observability
    const duration = performance.now() - startTime;
    logStructured('error', 'submission_failed', {
      request_id: requestId,
      error_id: err_id,
      status: 'error',
      duration_ms: Math.round(duration),
      error_message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    });

    // TEMP: raw JSON log for quick diagnosis
    console.error(JSON.stringify({
      err_id,
      scope: "submit_public_form",
      msg: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    }));

    // TEMP: include error message in response body (non-prod aid)
    return j(500, { error: "internal_error", id: err_id, message: e instanceof Error ? e.message : String(e) });
  }
});