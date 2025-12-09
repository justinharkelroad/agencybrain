import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { supaFromReq } from "../_shared/client.ts";

serve(async (req) => {
  if (handleOptions(req)) return handleOptions(req);

  try {
    const supabase = supaFromReq(req);
    
    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's agency
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'No agency found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure token
    const token = crypto.randomUUID() + '-' + Date.now().toString(36);

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert token into database
    const { data, error } = await supabase
      .from('roleplay_access_tokens')
      .insert({
        token,
        agency_id: profile.agency_id,
        created_by: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating token:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate shareable URL using SITE_URL secret
    const baseUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://myagencybrain.com';
    const shareableUrl = `${baseUrl}/roleplay-staff?t=${token}`;

    return new Response(
      JSON.stringify({
        success: true,
        token,
        url: shareableUrl,
        expires_at: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-roleplay-link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
