// STAFF GET DASHBOARD METRICS
// Returns quoted_count and sold_items from dashboard for a given work date
// Used by staff form to show accurate performance summary before submission

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const staffSessionToken = req.headers.get('x-staff-session');
    if (!staffSessionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing staff session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workDate } = await req.json();
    if (!workDate) {
      return new Response(
        JSON.stringify({ error: 'workDate is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', staffSessionToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('team_member_id, agency_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser || !staffUser.team_member_id) {
      return new Response(
        JSON.stringify({ error: 'Staff user not linked to team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lqs_households count for this team member on the work date
    const { count: quotedCount } = await supabase
      .from('lqs_households')
      .select('*', { count: 'exact', head: true })
      .eq('team_member_id', staffUser.team_member_id)
      .eq('agency_id', staffUser.agency_id)
      .eq('first_quote_date', workDate)
      .in('status', ['quoted', 'sold']);

    // Get metrics_daily for any pre-existing values
    const { data: metricsDaily } = await supabase
      .from('metrics_daily')
      .select('quoted_count, sold_items')
      .eq('team_member_id', staffUser.team_member_id)
      .eq('agency_id', staffUser.agency_id)
      .eq('date', workDate)
      .single();

    // Use max of lqs_households count and metrics_daily
    const dashboardQuotedCount = Math.max(quotedCount || 0, metricsDaily?.quoted_count || 0);
    const dashboardSoldCount = metricsDaily?.sold_items || 0;

    return new Response(
      JSON.stringify({
        success: true,
        dashboardQuotedCount,
        dashboardSoldCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in staff_get_dashboard_metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
