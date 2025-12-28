import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supaFromReq } from "../_shared/client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    
    // If not in query params, try body
    if (!token && req.method === 'POST') {
      try {
        const body = await req.json();
        token = body?.token;
      } catch {
        // Body parsing failed, token remains null
      }
    }
    
    // Check for staff session header
    const staffSessionToken = req.headers.get('x-staff-session');
    
    // Allow either authenticated users OR valid token OR valid staff session
    const supabase = supaFromReq(req);
    const { data: { user } } = await supabase.auth.getUser();

    // If authenticated user, allow access
    if (user) {
      console.log('Authenticated user accessing roleplay-config:', user.id);
    } 
    // If staff session header present, validate it
    else if (staffSessionToken) {
      console.log('Validating staff session token...');
      
      // Create admin client to query staff sessions
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Query staff_sessions table directly (same logic as staff_verify_session)
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('staff_sessions')
        .select(`
          *,
          staff_users!inner (
            id,
            username,
            display_name,
            agency_id,
            email,
            is_active
          )
        `)
        .eq('session_token', staffSessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.log('Invalid staff session token:', sessionError?.message);
        return new Response(
          JSON.stringify({ error: 'Invalid staff session' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if staff user is active
      if (!sessionData.staff_users?.is_active) {
        console.log('Staff user is inactive');
        return new Response(
          JSON.stringify({ error: 'Staff account is inactive' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Staff session authenticated:', sessionData.staff_users.display_name, 'Agency:', sessionData.staff_users.agency_id);
    }
    // If not authenticated, require and validate token
    else if (token) {
      // Validate token from roleplay_access_tokens table
      const { data: tokenData, error: tokenError } = await supabase
        .from('roleplay_access_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check expiration
      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Token expired' }),
          { 
            status: 410, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if invalidated
      if (tokenData.invalidated) {
        return new Response(
          JSON.stringify({ error: 'Token has been revoked' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if identity submitted (validated state)
      if (!tokenData.used || !tokenData.staff_name || !tokenData.staff_email) {
        return new Response(
          JSON.stringify({ error: 'Identity required - please submit your information first' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      // No user and no token and no staff session - unauthorized
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No user, token, or staff session provided' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const elevenApiKey = Deno.env.get('ELEVEN_API_KEY');
    const elevenAgentId = Deno.env.get('ELEVEN_AGENT_ID');

    if (!elevenApiKey || !elevenAgentId) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate signed URL for ElevenLabs Conversational AI
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${elevenAgentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": elevenApiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ signedUrl: data.signed_url }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in roleplay-config:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
