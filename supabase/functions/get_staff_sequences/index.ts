import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get session token from header
    const sessionToken = req.headers.get('x-staff-session');

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', nowISO)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, is_active')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser || !staffUser.is_active) {
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user not found or inactive' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = staffUser.agency_id;

    // Fetch active sequences for this agency
    const { data: sequences, error: seqError } = await supabase
      .from('onboarding_sequences')
      .select(`
        id,
        name,
        description,
        target_type,
        is_active,
        steps:onboarding_sequence_steps(id, day_number, action_type, title)
      `)
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('name');

    if (seqError) {
      console.error('Error fetching sequences:', seqError);
      return new Response(JSON.stringify({ error: 'Failed to fetch sequences', details: seqError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch staff users for assignee dropdown
    const { data: staffUsers, error: staffUsersError } = await supabase
      .from('staff_users')
      .select('id, display_name, username, is_active')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('display_name');

    if (staffUsersError) {
      console.error('Error fetching staff users:', staffUsersError);
    }

    // Fetch profile users for assignee dropdown
    const { data: profileUsers, error: profileUsersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('agency_id', agencyId)
      .order('full_name');

    if (profileUsersError) {
      console.error('Error fetching profile users:', profileUsersError);
    }

    return new Response(JSON.stringify({
      sequences: sequences || [],
      staff_users: staffUsers || [],
      profile_users: profileUsers || [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get_staff_sequences:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
