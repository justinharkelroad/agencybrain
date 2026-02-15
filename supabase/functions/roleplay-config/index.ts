import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supaFromReq } from "../_shared/client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

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
    
    // Allow either authenticated users/staff session OR valid token
    const supabase = supaFromReq(req);
    const hasAuthHeader = !!req.headers.get('Authorization');
    const hasStaffSession = !!req.headers.get('x-staff-session');
    let hasVerifiedAuth = false;

    if (hasAuthHeader || hasStaffSession) {
      const authResult = await verifyRequest(req);
      if (!isVerifyError(authResult)) {
        hasVerifiedAuth = true;
        if (authResult.mode === 'supabase' && authResult.userId) {
          console.log('Authenticated user accessing roleplay-config:', authResult.userId);
        } else if (authResult.mode === 'staff' && authResult.staffUserId) {
          console.log('Staff session authenticated accessing roleplay-config:', authResult.staffUserId);
        }
      }
    }

    if (!hasVerifiedAuth && token) {
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
    } else if (!hasVerifiedAuth) {
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
