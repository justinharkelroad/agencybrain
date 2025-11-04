import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supaFromReq } from "../_shared/client.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const supabase = supaFromReq(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get secrets from environment
    const elevenApiKey = Deno.env.get('ELEVEN_API_KEY');
    const elevenAgentId = Deno.env.get('ELEVEN_AGENT_ID');
    const elevenVoiceId = Deno.env.get('ELEVEN_VOICE_ID');
    const heygenEmbedToken = Deno.env.get('HEYGEN_EMBED_TOKEN');
    const heygenAvatarId = Deno.env.get('HEYGEN_AVATAR_ID');

    // Validate all secrets are present
    if (!elevenApiKey || !elevenAgentId || !elevenVoiceId || !heygenEmbedToken || !heygenAvatarId) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return configuration object (secrets proxied through backend)
    const config = {
      elevenlabs: {
        apiKey: elevenApiKey,
        agentId: elevenAgentId,
        voiceId: elevenVoiceId,
      },
      heygen: {
        embedToken: heygenEmbedToken,
        avatarId: heygenAvatarId,
      },
    };

    return new Response(
      JSON.stringify(config),
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
