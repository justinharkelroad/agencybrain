import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (handleOptions(req)) return handleOptions(req);

  try {
    const { token, reason } = await req.json();

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

    // Invalidate token
    const { error } = await supabase
      .from('roleplay_access_tokens')
      .update({
        invalidated: true,
        invalidated_at: new Date().toISOString(),
        invalidated_reason: reason || 'manual'
      })
      .eq('token', token);

    if (error) {
      console.error('Error invalidating token:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to invalidate token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Token invalidated: ${token} (reason: ${reason})`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in invalidate-roleplay-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
