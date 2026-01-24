import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Minimum time between refreshes (30 minutes in milliseconds)
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
// Session duration (24 hours in milliseconds)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find valid session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('id, expires_at, created_at')
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check if session was refreshed recently
    // We calculate this by checking if (expires_at - 24h + 30min) > now
    // This means the session was refreshed less than 30 minutes ago
    const expiresAt = new Date(session.expires_at);
    const lastRefreshedAt = new Date(expiresAt.getTime() - SESSION_DURATION_MS);
    const cooldownEndsAt = new Date(lastRefreshedAt.getTime() + REFRESH_COOLDOWN_MS);
    const now = new Date();

    if (now < cooldownEndsAt) {
      // Within cooldown period - return success with current expires_at (idempotent)
      return new Response(
        JSON.stringify({
          success: true,
          expires_at: session.expires_at,
          refreshed: false,
          message: 'Session refresh on cooldown'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extend session by 24 hours from now
    const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    const { error: updateError } = await supabase
      .from('staff_sessions')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('id', session.id);

    if (updateError) {
      console.error('Session refresh error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to refresh session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: newExpiresAt.toISOString(),
        refreshed: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Session refresh error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
