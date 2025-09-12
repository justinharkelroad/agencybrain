import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const url = new URL(req.url);
    const agencySlug = url.searchParams.get('agencySlug');
    const formSlug = url.searchParams.get('formSlug');
    const token = url.searchParams.get('token');

    if (!agencySlug || !formSlug || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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
      .eq('is_enabled', true)
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
    if (linkData.expire_at && new Date(linkData.expire_at) < new Date()) {
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

    return new Response(
      JSON.stringify({
        form: linkData.form_template,
        agency: linkData.agency,
        link: {
          id: linkData.id,
          token: linkData.token,
          expire_at: linkData.expire_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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