import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (handleOptions(req)) return handleOptions(req);

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client without auth (public access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Query token
    const { data: tokenData, error } = await supabase
      .from('roleplay_access_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invalidated
    if (tokenData.invalidated) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token invalidated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token is valid
    return new Response(
      JSON.stringify({
        valid: true,
        requires_identity: !tokenData.staff_name || !tokenData.staff_email,
        agency_id: tokenData.agency_id,
        used: tokenData.used
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-roleplay-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
