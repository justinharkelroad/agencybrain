import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    
    if (!sessionToken) {
      console.log('[get_staff_flows] No session token provided');
      return new Response(
        JSON.stringify({ error: 'No session token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify session
    console.log('[get_staff_flows] Verifying session token');
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.log('[get_staff_flows] Invalid session:', sessionError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      console.log('[get_staff_flows] Session expired');
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;
    console.log('[get_staff_flows] Staff user ID:', staffUserId);

    // Fetch active flow templates
    const { data: templates, error: templatesError } = await supabase
      .from('flow_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (templatesError) {
      console.error('[get_staff_flows] Error fetching templates:', templatesError);
    }

    // Fetch flow sessions for this staff user
    const { data: sessions, error: sessionsError } = await supabase
      .from('flow_sessions')
      .select('*, flow_template:flow_templates(*)')
      .eq('user_id', staffUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessionsError) {
      console.error('[get_staff_flows] Error fetching sessions:', sessionsError);
    }

    // Fetch flow profile for this staff user
    const { data: profile, error: profileError } = await supabase
      .from('flow_profiles')
      .select('*')
      .eq('user_id', staffUserId)
      .maybeSingle();

    if (profileError) {
      console.error('[get_staff_flows] Error fetching profile:', profileError);
    }

    console.log('[get_staff_flows] Success - templates:', templates?.length, 'sessions:', sessions?.length, 'hasProfile:', !!profile?.preferred_name);

    return new Response(
      JSON.stringify({
        templates: templates || [],
        sessions: sessions || [],
        profile: profile,
        hasProfile: !!profile?.preferred_name,
        staffUserId,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[get_staff_flows] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
