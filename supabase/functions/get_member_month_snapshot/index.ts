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
    const teamMemberId = url.searchParams.get('teamMemberId');
    const month = url.searchParams.get('month'); // YYYY-MM format

    if (!teamMemberId || !month) {
      return new Response(
        JSON.stringify({ error: 'Missing teamMemberId or month parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate start and end dates for the month
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

    // Get member snapshot data for the month
    const { data, error } = await supabase
      .from('metrics_daily')
      .select(`
        date,
        outbound_calls,
        talk_minutes,
        quoted_count,
        sold_items,
        sold_policies,
        sold_premium_cents,
        cross_sells_uncovered,
        mini_reviews,
        pass,
        daily_score,
        is_late,
        streak_count,
        kpi_version_id,
        label_at_submit
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

    return new Response(
      JSON.stringify({ data }),
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