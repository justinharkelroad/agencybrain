// deno-lint-ignore-file no-explicit-any
// PUBLIC FORM SUBMIT - NO AUTH REQUIRED
// TOKEN-BASED VALIDATION ONLY
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "3.3-PUBLIC-NO-AUTH";
const DEPLOYMENT_ID = "deploy-20250910-public";

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

function json(status: number, body: any) {
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

type Body = {
  agencySlug: string;
  formSlug: string;
  token: string;
  teamMemberId: string;
  submissionDate: string;  // YYYY-MM-DD
  workDate?: string;       // optional
  values: Record<string, unknown>;
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

    // NORMALIZE PAYLOAD SERVER-SIDE
    const v = body.values ?? {};
    const details = Array.isArray(v.quoted_details) ? v.quoted_details : 
                   (Array.isArray(v.quotedDetails) ? v.quotedDetails : []);
    const cleaned = details.filter((d: any) => d && (d.prospect_name || d.lead_source || d.detailed_notes));
    v.quoted_details = cleaned;
    delete v.quotedDetails; // Remove camelCase version
    
    logStructured('info', 'payload_normalized', {
      request_id: requestId,
      quoted_details_count: cleaned.length
    });

    // TOKEN VALIDATION - public, no user auth required
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
      return errorResponse(401, "unauthorized");
    }

    if (!link.enabled || (link.expires_at && new Date(link.expires_at) < new Date())) {
      logStructured('warn', 'token_expired_disabled', {
        request_id: requestId,
        token: body.token.substring(0, 8) + '...',
        enabled: link.enabled,
        expires_at: link.expires_at
      });
      return errorResponse(401, "unauthorized");
    }

    logStructured('info', 'token_validated', {
      request_id: requestId,
      form_link_id: link.id
    });

    // Get form template
    const { data: template, error: templateError } = await supabase
      .from('form_templates')
      .select('id, slug, status, settings_json, agency_id')
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

    // Supersede previous final submissions
    const { data: prev } = await supabase
      .from("submissions")
      .select("id")
      .eq("form_template_id", template.id)
      .eq("team_member_id", body.teamMemberId)
      .or(`work_date.eq.${finalDate},and(work_date.is.null,submission_date.eq.${finalDate})`)
      .eq("final", true);

    if (prev?.length) {
      logStructured('info', 'superseding_submissions', {
        request_id: requestId,
        count: prev.length
      });
      
      await supabase
        .from("submissions")
        .update({ final: false, superseded_at: new Date().toISOString() })
        .in("id", prev.map((r: any) => r.id));
    }

    // Insert new submission
    const { data: ins, error: insErr } = await supabase
      .from("submissions")
      .insert({
        form_template_id: template.id,
        team_member_id: body.teamMemberId,
        submission_date: body.submissionDate,
        work_date: body.workDate ?? null,
        late: isLate,
        final: true,
        payload_json: v // Use normalized values
      })
      .select("id")
      .single();

    if (insErr) {
      const errorId = crypto.randomUUID();
      logStructured('error', 'submission_insert_failed', {
        request_id: requestId,
        error_id: errorId,
        error: insErr.message
      });
      return errorResponse(500, "internal_error", errorId);
    }

    logStructured('info', 'submission_created', {
      request_id: requestId,
      submission_id: ins.id
    });

    // Resolve KPI version for metrics
    const { data: kpiBinding } = await supabase
      .from('forms_kpi_bindings')
      .select(`
        kpi_version_id,
        kpi_versions!inner(
          id,
          label,
          kpi_id,
          kpis!inner(
            id,
            key,
            agency_id
          )
        )
      `)
      .eq('form_template_id', template.id)
      .maybeSingle();

    let kpiVersionId = null;
    let labelAtSubmit = null;

    if (kpiBinding?.kpi_versions) {
      kpiVersionId = kpiBinding.kpi_version_id;
      labelAtSubmit = kpiBinding.kpi_versions.label;
      
      logStructured('info', 'kpi_version_resolved', {
        request_id: requestId,
        kpi_version_id: kpiVersionId,
        label: labelAtSubmit
      });
    }

    // Process metrics with explicit null coalescing
    const { error: metricsError } = await supabase.rpc('upsert_metrics_from_submission', {
      p_submission: ins.id,
      p_kpi_version_id: kpiVersionId ?? null,
      p_label_at_submit: labelAtSubmit ?? null,
      p_submitted_at: new Date().toISOString()
    });
    
    if (metricsError) {
      logStructured('warn', 'metrics_processing_failed', {
        request_id: requestId,
        submission_id: ins.id,
        error: metricsError.message
      });
      // Don't fail submission for metrics errors
    }

    const duration = performance.now() - startTime;

    // Success logging
    logStructured('info', 'submission_success', {
      submission_id: ins.id,
      team_member_id: body.teamMemberId,
      agency_id: agency.id,
      kpi_version_id: kpiVersionId,
      label_at_submit: labelAtSubmit,
      status: 'ok',
      duration_ms: Math.round(duration),
      request_id: requestId
    });

    return json(200, { 
      ok: true, 
      submissionId: ins.id,
      isLate
    });

  } catch (e) {
    const errorId = crypto.randomUUID();
    const duration = performance.now() - startTime;
    
    logStructured('error', 'submission_failed', {
      request_id: requestId,
      error_id: errorId,
      status: 'error',
      duration_ms: Math.round(duration),
      error_message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined
    });
    
    return errorResponse(500, "internal_error", errorId);
  }
});