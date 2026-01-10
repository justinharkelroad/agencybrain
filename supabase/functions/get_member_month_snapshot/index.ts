import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    // Check for staff session first
    const staffSessionToken = req.headers.get('x-staff-session');
    let agencyIdFromSession: string | null = null;

    if (staffSessionToken) {
      // Verify staff session
      const { data: session, error: sessionError } = await supabase
        .from('staff_sessions')
        .select('staff_user_id, agency_id, expires_at')
        .eq('session_token', staffSessionToken)
        .single();

      if (sessionError || !session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired staff session' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      agencyIdFromSession = session.agency_id;
    }

    const url = new URL(req.url);
    // Accept both parameter names for compatibility
    const teamMemberId = url.searchParams.get('teamMemberId') || url.searchParams.get('member_id');
    const month = url.searchParams.get('month'); // YYYY-MM format

    if (!teamMemberId || !month) {
      return new Response(
        JSON.stringify({ error: 'Missing teamMemberId/member_id or month parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate start and end dates for the month
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

    // Get team member info including agency_id
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('id, name, role, agency_id')
      .eq('id', teamMemberId)
      .single();

    if (memberError || !member) {
      console.error('Member lookup error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Team member not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Security check: if staff session, ensure team member belongs to the staff's agency
    if (staffSessionToken && agencyIdFromSession && member.agency_id !== agencyIdFromSession) {
      return new Response(
        JSON.stringify({ error: 'Access denied: team member belongs to a different agency' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get scorecard rules to find selected_metrics for this agency and role
    const { data: scorecardRule, error: scorecardError } = await supabase
      .from('scorecard_rules')
      .select('selected_metrics')
      .eq('agency_id', member.agency_id)
      .eq('role', member.role)
      .maybeSingle();

    if (scorecardError) {
      console.error('Scorecard rules lookup error:', scorecardError);
    }

    // Use selected_metrics length as required count, default to 5
    const selectedMetrics: string[] = scorecardRule?.selected_metrics || [];
    const requiredCount = selectedMetrics.length > 0 ? selectedMetrics.length : 5;

    console.log('Selected metrics for', member.name, ':', selectedMetrics, 'Required count:', requiredCount);

    // Get member metrics data for the month
    const { data, error } = await supabase
      .from('metrics_daily')
      .select(`
        date,
        pass,
        hits,
        outbound_calls,
        talk_minutes,
        quoted_count,
        sold_items,
        sold_policies,
        sold_premium_cents,
        cross_sells_uncovered,
        mini_reviews
      `)
      .eq('team_member_id', teamMemberId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Member snapshot query error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch member snapshot data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Transform data into expected days format
    const days = (data || []).map(row => {
      // Use the hits value from the row (already calculated during submission)
      // or calculate based on selected metrics if hits is null
      const metCount = row.hits ?? 0;

      return {
        date: row.date,
        pass: row.pass ?? false,
        met_count: metCount,
        required_count: requiredCount
      };
    });

    // Return in expected format
    return new Response(
      JSON.stringify({
        member: {
          id: member.id,
          name: member.name,
          role: member.role
        },
        month: month,
        days: days
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Member snapshot error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
