import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "rp-1.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- get params (POST JSON first, then query fallback; support token alias "t")
    const url = new URL(req.url);
    const qp = url.searchParams;

    let agencySlug: string | null = null;
    let formSlug: string | null = null;
    let token: string | null = null;

    try {
      if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json().catch(() => ({} as any));
        agencySlug = body.agencySlug ?? body.agency_slug ?? qp.get("agencySlug") ?? qp.get("agency_slug");
        formSlug   = body.formSlug   ?? body.form_slug   ?? qp.get("formSlug")   ?? qp.get("form_slug");
        token      = body.token      ?? body.t           ?? qp.get("token")      ?? qp.get("t");
      } else {
        agencySlug = qp.get("agencySlug") ?? qp.get("agency_slug");
        formSlug   = qp.get("formSlug")   ?? qp.get("form_slug");
        token      = qp.get("token")      ?? qp.get("t");
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "bad_request", message: String(e) }), {
        status: 400, headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    if (!agencySlug || !formSlug || !token) {
      return new Response(JSON.stringify({
        error: "missing_params",
        agencySlug, formSlug, tokenPresent: Boolean(token)
      }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Validate form link token
    const { data: linkData, error: linkError } = await supabase
      .from('form_links')
      .select(`
        *,
        form_template:form_templates(*),
        agency:agencies(*)
      `)
      .eq('token', token)
      .eq('enabled', true)
      .single();

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or disabled form link' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check expiration
    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Form link has expired' }),
        { 
          status: 410, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate agency and form slugs match
    if (linkData.agency.slug !== agencySlug || linkData.form_template.slug !== formSlug) {
      return new Response(
        JSON.stringify({ error: 'Agency or form slug mismatch' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get agency ID for additional queries
    const agencyId = linkData.form_template.agency_id;

    // Query team_members and lead_sources
    const { data: teamMembers, error: tmErr } = await supabase
      .from('team_members')
      .select('id,name')
      .eq('agency_id', agencyId)
      .eq('status', 'active');

    const { data: leadSources, error: lsErr } = await supabase
      .from('lead_sources')
      .select('id,name')
      .eq('agency_id', agencyId);

    // Transform DB fields → UI fields
    const ft = linkData.form_template;

    // schema_json *already* contains schema + nested settings in this project.
    // settings_json contains legacy settings. Prefer nested settings first.
    const schemaObj = ft.schema_json ?? {};
    const settingsObj = schemaObj.settings ?? ft.settings_json ?? {};

    const form = {
      id: ft.id,
      slug: ft.slug,
      agency_id: ft.agency_id,
      title: schemaObj.title ?? ft.title ?? '',
      role: schemaObj.role ?? 'Sales',
      schema: schemaObj,        // full schema object (kpis, customFields, repeaterSections, etc.)
      settings: settingsObj,      // extracted settings
      team_members: teamMembers ?? [],
      lead_sources: leadSources ?? [],
    };

    return new Response(
      JSON.stringify({ form }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'content-type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Form resolution error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});