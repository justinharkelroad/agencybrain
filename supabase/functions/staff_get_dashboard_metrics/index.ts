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

    // Get lqs_households with full details for this team member on the work date
    const { data: quotedHouseholds } = await supabase
      .from('lqs_households')
      .select(`
        id, first_name, last_name, lead_source_id, notes, objection_id, zip_code,
        lqs_objections(name),
        lqs_quotes(product_type, items_quoted, premium_cents)
      `)
      .eq('team_member_id', staffUser.team_member_id)
      .eq('agency_id', staffUser.agency_id)
      .eq('first_quote_date', workDate)
      .in('status', ['quoted', 'sold'])
      .order('created_at');

    const quotedCount = quotedHouseholds?.length || 0;

    // Map to form repeater format
    const quotedDetails = (quotedHouseholds || []).map(h => ({
      prospect_name: `${h.first_name || ''} ${h.last_name || ''}`.trim(),
      lead_source: h.lead_source_id || '',
      zip_code: h.zip_code || '',
      detailed_notes: [
        h.notes || '',
        h.objection_id ? `[Objection: ${(h as any).lqs_objections?.name || 'Unknown'}]` : ''
      ].filter(Boolean).join('\n') || '',
      policies_quoted: (h as any).lqs_quotes?.length || 0,
      items_quoted: (h as any).lqs_quotes?.reduce((sum: number, q: any) => sum + (q.items_quoted || 0), 0) || 0,
      premium_potential: ((h as any).lqs_quotes?.reduce((sum: number, q: any) => sum + (q.premium_cents || 0), 0) || 0) / 100,
      _lqs_household_id: h.id,
      _from_dashboard: true,
    }));

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

    // Get targets from targets table (staff can't query this directly due to RLS)
    const { data: targetRows } = await supabase
      .from('targets')
      .select('metric_key, value_number, team_member_id')
      .eq('agency_id', staffUser.agency_id);

    const targets: Record<string, number> = {};
    if (targetRows) {
      // First load agency defaults (team_member_id = null)
      targetRows.forEach(t => {
        if (!t.team_member_id) {
          targets[t.metric_key] = t.value_number;
        }
      });
      // Then override with member-specific targets if they exist
      targetRows.forEach(t => {
        if (t.team_member_id === staffUser.team_member_id) {
          targets[t.metric_key] = t.value_number;
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dashboardQuotedCount,
        dashboardSoldCount,
        targets,
        quotedDetails,
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
