import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request (supports both Supabase JWT and staff session)
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

    const { agencyId } = authResult;

    // Create service role client for all DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    // Security check: ensure team member belongs to the authenticated user's agency
    if (member.agency_id !== agencyId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: team member belongs to a different agency' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get scorecard rules to find selected_metrics for this agency and role
    // For Hybrid members, try Hybrid rules first, then Sales, then Service as fallback
    const rolesToTry = member.role === 'Hybrid' ? ['Hybrid', 'Sales', 'Service'] : [member.role];
    let scorecardRule: { selected_metrics: string[] } | null = null;

    for (const roleToTry of rolesToTry) {
      const { data: rule, error: ruleError } = await supabase
        .from('scorecard_rules')
        .select('selected_metrics')
        .eq('agency_id', member.agency_id)
        .eq('role', roleToTry)
        .maybeSingle();

      if (ruleError) {
        console.error('Scorecard rules lookup error:', ruleError);
      }
      if (rule) {
        scorecardRule = rule;
        break;
      }
    }

    // Default required count from member's role-based rules (fallback for days without scoring_role)
    const defaultSelectedMetrics: string[] = scorecardRule?.selected_metrics || [];
    const defaultRequiredCount = defaultSelectedMetrics.length > 0 ? defaultSelectedMetrics.length : 5;

    // Get member metrics data for the month (include scoring_role for per-day rule resolution)
    const { data, error } = await supabase
      .from('metrics_daily')
      .select(`
        date,
        pass,
        hits,
        scoring_role,
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

    // For Hybrid members: look up required_count per scoring_role so each day's
    // tooltip reflects the correct rule set (Sales-scored days vs Hybrid-scored days)
    const requiredCountByRole: Record<string, number> = {};
    if (member.role === 'Hybrid') {
      const uniqueRoles = [...new Set((data || []).map((r: any) => r.scoring_role).filter(Boolean))];
      for (const sr of uniqueRoles) {
        const { data: rule } = await supabase
          .from('scorecard_rules')
          .select('selected_metrics')
          .eq('agency_id', member.agency_id)
          .eq('role', sr)
          .maybeSingle();
        const metrics = rule?.selected_metrics || [];
        requiredCountByRole[sr as string] = metrics.length > 0 ? metrics.length : defaultRequiredCount;
      }
    }

    // Transform data into expected days format
    const days = (data || []).map((row: any) => {
      const metCount = row.hits ?? 0;
      // Per-day required_count: use scoring_role-specific count if available, else default
      const reqCount = (member.role === 'Hybrid' && row.scoring_role)
        ? (requiredCountByRole[row.scoring_role] ?? defaultRequiredCount)
        : defaultRequiredCount;

      return {
        date: row.date,
        pass: row.pass ?? false,
        met_count: metCount,
        required_count: reqCount
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
