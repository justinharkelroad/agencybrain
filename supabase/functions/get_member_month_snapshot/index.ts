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

    // Get team member info
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('id, name, role')
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
      // Count non-zero metrics as "met" (simplified calculation)
      const metrics = [
        row.outbound_calls,
        row.talk_minutes,
        row.quoted_count,
        row.sold_items,
        row.sold_policies,
        row.cross_sells_uncovered,
        row.mini_reviews
      ];
      
      const metCount = row.hits ?? metrics.filter(m => m && m > 0).length;
      const requiredCount = metrics.filter(m => m !== null && m !== undefined).length || 1;

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
