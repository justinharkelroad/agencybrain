import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get params from POST body or query string
    const url = new URL(req.url);
    const qp = url.searchParams;

    let agencySlug: string | null = null;
    let formSlug: string | null = null;
    let token: string | null = null;

    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      agencySlug = body.agencySlug ?? body.agency_slug ?? qp.get("agencySlug") ?? qp.get("agency_slug");
      formSlug = body.formSlug ?? body.form_slug ?? qp.get("formSlug") ?? qp.get("form_slug");
      token = body.token ?? body.t ?? qp.get("token") ?? qp.get("t");
    } else {
      agencySlug = qp.get("agencySlug") ?? qp.get("agency_slug");
      formSlug = qp.get("formSlug") ?? qp.get("form_slug");
      token = qp.get("token") ?? qp.get("t");
    }
    
    console.log('=== RESOLVE PUBLIC FORM ===');
    console.log('Params:', { agencySlug, formSlug, token: token ? `${token.substring(0, 8)}...` : null });

    if (!agencySlug || !formSlug || !token) {
      return new Response(
        JSON.stringify({ error: 'missing_params', agencySlug, formSlug, tokenPresent: Boolean(token) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Query 1: Get form_link by token (simple, no joins)
    const { data: formLink, error: linkError } = await supabase
      .from('form_links')
      .select('*')
      .eq('token', token)
      .eq('enabled', true)
      .single();

    console.log('Form link query result:', { found: !!formLink, error: linkError?.message });

    if (linkError || !formLink) {
      return new Response(
        JSON.stringify({ error: 'Invalid or disabled form link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (formLink.expires_at && new Date(formLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Form link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query 2: Get form_template by ID (simple, no joins)
    const { data: formTemplate, error: templateError } = await supabase
      .from('form_templates')
      .select('*')
      .eq('id', formLink.form_template_id)
      .eq('is_active', true)
      .single();

    console.log('Form template query result:', { found: !!formTemplate, error: templateError?.message });

    if (templateError || !formTemplate) {
      return new Response(
        JSON.stringify({ error: 'Form template not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query 3: Get agency by ID (simple, no joins)
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', formTemplate.agency_id)
      .single();

    console.log('Agency query result:', { found: !!agency, error: agencyError?.message });

    if (agencyError || !agency) {
      return new Response(
        JSON.stringify({ error: 'Agency not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate slugs match URL
    if (agency.slug !== agencySlug) {
      console.log('Agency slug mismatch:', { expected: agencySlug, actual: agency.slug });
      return new Response(
        JSON.stringify({ error: 'Agency slug mismatch' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (formTemplate.slug !== formSlug) {
      console.log('Form slug mismatch:', { expected: formSlug, actual: formTemplate.slug });
      return new Response(
        JSON.stringify({ error: 'Form slug mismatch' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query 4: Get team members for dropdown
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name, role, email')
      .eq('agency_id', agency.id)
      .eq('status', 'active')
      .order('name');

    // Query 5: Get lead sources
    const { data: leadSources } = await supabase
      .from('lead_sources')
      .select('id, name, is_active')
      .eq('agency_id', agency.id)
      .eq('is_active', true)
      .order('name');

    // Build response matching what the frontend expects
    const schemaObj = formTemplate.schema_json ?? {};
    const settingsObj = schemaObj.settings ?? formTemplate.settings_json ?? {};

    const form = {
      id: formTemplate.id,
      slug: formTemplate.slug,
      agency_id: formTemplate.agency_id,
      title: schemaObj.title ?? formTemplate.name ?? '',
      role: schemaObj.role ?? formTemplate.role ?? 'Sales',
      schema: schemaObj,
      settings: settingsObj,
      team_members: teamMembers || [],
      lead_sources: leadSources || [],
    };

    console.log('=== SUCCESS ===');
    
    return new Response(
      JSON.stringify({ form }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
