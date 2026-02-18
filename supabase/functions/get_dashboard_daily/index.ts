import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface DashboardDailyRow {
  team_member_id: string | null;
  rep_name: string | null;
  work_date: string; // YYYY-MM-DD
  outbound_calls: number | null;
  talk_minutes: number | null;
  quoted_count: number | null;
  sold_items: number | null;
  sold_policies: number | null;
  sold_premium_cents: number | null;
  cross_sells_uncovered: number | null;
  mini_reviews: number | null;
  pass: boolean | null;
  hits: number | null;
  daily_score: number | null;
  is_late: boolean | null;
  status: string | null;
}

interface MetricsDailyFactRow {
  team_member_id: string | null;
  call_metrics_mode: string | null;
  outbound_calls_manual: number | null;
  talk_minutes_manual: number | null;
  outbound_calls_auto: number | null;
  talk_minutes_auto: number | null;
}

interface CallMetricsDailyRow {
  team_member_id: string | null;
  outbound_calls: number | null;
  total_talk_seconds: number | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request using dual-mode auth (Supabase JWT or Staff session)
    const authResult = await verifyRequest(req);
    
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: authResult.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create service role client for database queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const agencySlug = url.searchParams.get('agencySlug');
    const workDate = url.searchParams.get('workDate'); // YYYY-MM-DD format
    const role = url.searchParams.get('role'); // "Sales" or "Service"

    if (!workDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: workDate' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(workDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate role parameter
    if (!role || !['Sales', 'Service'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing role parameter. Use "Sales" or "Service"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get agency ID - use verified auth context, fallback to slug lookup
    let agencyId = authResult.agencyId;
    
    // If agencySlug provided, verify it matches the authenticated user's agency
    if (agencySlug) {
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id')
        .eq('slug', agencySlug)
        .single();

      if (agencyError || !agency) {
        console.error('Agency lookup error:', agencyError);
        return new Response(
          JSON.stringify({ error: 'Agency not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // For security, ensure requested agency matches authenticated user's agency
      if (agency.id !== authResult.agencyId) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this agency' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      agencyId = agency.id;
    }

    // Query vw_metrics_with_team view directly, filtering by role.
    // Include selected role + Hybrid only. Including Manager here can cause
    // enum/view mismatch errors in some environments and trigger 500s.
    const { data, error } = await supabase
      .from('vw_metrics_with_team')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('date', workDate)
      .or(`role.eq.${role},role.eq.Hybrid`)
      .order('rep_name', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Dashboard daily query error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch dashboard data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { data: agencyModeData, error: agencyModeError } = await supabase
      .from('agencies')
      .select('call_metrics_mode, timezone')
      .eq('id', agencyId)
      .single();

    if (agencyModeError) {
      console.error('Dashboard daily agency mode query error:', agencyModeError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch agency call metrics mode' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const agencyCallMetricsMode = (agencyModeData?.call_metrics_mode || 'off') as 'off' | 'shadow' | 'on';

    const { data: factsData, error: factsError } = await supabase
      .from('metrics_daily_facts')
      .select('team_member_id, call_metrics_mode, outbound_calls_manual, talk_minutes_manual, outbound_calls_auto, talk_minutes_auto')
      .eq('agency_id', agencyId)
      .eq('date', workDate);

    if (factsError) {
      console.error('Dashboard daily facts query error:', factsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch dashboard facts data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const factsByTeamMember = new Map<string, MetricsDailyFactRow>();
    for (const fact of (factsData || []) as MetricsDailyFactRow[]) {
      if (fact.team_member_id) {
        factsByTeamMember.set(fact.team_member_id, fact);
      }
    }

    const { data: callDailyData, error: callDailyError } = await supabase
      .from('call_metrics_daily')
      .select('team_member_id, outbound_calls, total_talk_seconds')
      .eq('agency_id', agencyId)
      .eq('date', workDate);

    if (callDailyError) {
      console.error('Dashboard daily call_metrics_daily query error:', callDailyError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call metrics daily data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const callDailyByTeamMember = new Map<string, { outbound: number; talkMinutes: number }>();
    for (const callRow of (callDailyData || []) as CallMetricsDailyRow[]) {
      if (!callRow.team_member_id) continue;
      callDailyByTeamMember.set(callRow.team_member_id, {
        outbound: callRow.outbound_calls || 0,
        talkMinutes: Math.round((callRow.total_talk_seconds || 0) / 60),
      });
    }

    let agencyCallTotals: { outbound_calls: number; talk_minutes: number } | null = null;
    if (agencyCallMetricsMode === 'on' || agencyCallMetricsMode === 'shadow') {
      // Build agency-wide totals from call_metrics_daily first.
      // For RingCentral, this is authoritative (Users sheet).
      const callDailyAgencyTotals = (callDailyData || []).reduce(
        (acc, row) => {
          acc.outbound_calls += Number(row.outbound_calls) || 0;
          acc.talk_minutes += Math.round((Number(row.total_talk_seconds) || 0) / 60);
          return acc;
        },
        { outbound_calls: 0, talk_minutes: 0 }
      );

      if (callDailyAgencyTotals.outbound_calls > 0 || callDailyAgencyTotals.talk_minutes > 0) {
        agencyCallTotals = callDailyAgencyTotals;
      }

      // Fallback: query agency-wide call totals from raw call_events.
      // This includes ALL calls (matched + unmatched) for providers without
      // authoritative daily summary rows.
      const { data: totalsData, error: totalsError } = await supabase
        .rpc('get_agency_call_totals_from_events', {
          p_agency_id: agencyId,
          p_date: workDate,
          p_timezone: agencyModeData?.timezone || 'America/New_York',
        })
        .single();

      if (totalsError) {
        console.error('Dashboard daily agency call totals error:', totalsError);
        // Non-fatal — fall back to per-member sums in the frontend
      } else if (totalsData) {
        const outboundCalls = Number(totalsData.outbound_calls) || 0;
        const talkMinutes = Number(totalsData.talk_minutes) || 0;

        // Use raw event totals only when we do not already have authoritative
        // daily summary totals from call_metrics_daily.
        if (!agencyCallTotals && (outboundCalls > 0 || talkMinutes > 0)) {
          agencyCallTotals = {
            outbound_calls: outboundCalls,
            talk_minutes: talkMinutes,
          };
        }
      }
    }

    // Transform view data to match expected interface and enforce call metrics mode.
    // In 'on' and 'shadow' modes, auto call values are surfaced (shadow = visible but no scoring impact).
    // In 'off' mode, call fields only come from actual submitted scorecards.
    const rows: DashboardDailyRow[] = (data || []).map((row) => {
      const fact = row.team_member_id ? factsByTeamMember.get(row.team_member_id) : undefined;
      const mode = agencyCallMetricsMode;
      const manualOutbound = fact?.outbound_calls_manual || 0;
      const manualTalk = fact?.talk_minutes_manual || 0;
      const callDaily = row.team_member_id ? callDailyByTeamMember.get(row.team_member_id) : undefined;
      const autoOutbound = callDaily?.outbound ?? fact?.outbound_calls_auto ?? 0;
      const autoTalk = callDaily?.talkMinutes ?? fact?.talk_minutes_auto ?? 0;
      const hasSubmittedScorecard = Boolean(row.final_submission_id);
      const outboundCalls = (mode === 'on' || mode === 'shadow')
        ? Math.max(autoOutbound, manualOutbound)
        : (hasSubmittedScorecard ? manualOutbound : 0);
      const talkMinutes = (mode === 'on' || mode === 'shadow')
        ? Math.max(autoTalk, manualTalk)
        : (hasSubmittedScorecard ? manualTalk : 0);

      return {
        team_member_id: row.team_member_id,
        rep_name: row.rep_name || 'Unassigned',
        work_date: row.date,
        outbound_calls: outboundCalls,
        talk_minutes: talkMinutes,
        quoted_count: row.quoted_households || row.quoted_count || 0,
        sold_items: row.items_sold || row.sold_items || 0,
        sold_policies: row.sold_policies || 0,
        sold_premium_cents: row.sold_premium_cents || 0,
        cross_sells_uncovered: row.cross_sells_uncovered || 0,
        mini_reviews: row.mini_reviews || 0,
        pass: row.pass || false,
        hits: row.hits || 0,
        daily_score: row.daily_score || 0,
        is_late: row.is_late || false,
        status: row.status || 'final'
      };
    });

    console.log(`Dashboard daily [${authResult.mode}]: Found ${rows.length} rows for agency ${agencySlug || agencyId} on ${workDate} with role ${role}`);

    return new Response(
      JSON.stringify({ rows, agencyCallTotals }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Dashboard daily error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
