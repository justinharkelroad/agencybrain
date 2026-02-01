import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAgencyRequest {
  name: string;
  agency_email?: string;
  phone?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to identify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateAgencyRequest = await req.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Agency name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already has an agency
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (existingProfile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'User already has an agency linked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the agency
    const { data: agency, error: agencyError } = await serviceClient
      .from('agencies')
      .insert([{
        name: body.name.trim(),
        agency_email: body.agency_email?.trim() || null,
        phone: body.phone?.trim() || null,
      }])
      .select('id')
      .single();

    if (agencyError) {
      console.error('[create-agency-and-link-profile] Failed to create agency:', agencyError);
      throw agencyError;
    }

    // Link the profile to the new agency (privileged operation)
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({ agency_id: agency.id })
      .eq('id', user.id);

    if (profileError) {
      console.error('[create-agency-and-link-profile] Failed to link profile:', profileError);
      // Attempt to clean up the agency we just created
      await serviceClient.from('agencies').delete().eq('id', agency.id);
      throw profileError;
    }

    console.log('[create-agency-and-link-profile] Created agency', agency.id, 'for user', user.id);

    return new Response(
      JSON.stringify({ success: true, agency_id: agency.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-agency-and-link-profile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create agency' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
