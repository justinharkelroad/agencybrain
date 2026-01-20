import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Query vw_metrics_with_team view directly, filtering by role
    // Include the selected role, Hybrid (hybrid team members appear in both tabs),
    // and Manager (managers have scorecard form access parity with Hybrid)
    const { data, error } = await supabase
      .from('vw_metrics_with_team')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('date', workDate)
      .or(`role.eq.${role},role.eq.Hybrid,role.eq.Manager`)
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

    // Transform view data to match expected interface
    const rows: DashboardDailyRow[] = (data || []).map(row => ({
      team_member_id: row.team_member_id,
      rep_name: row.rep_name || 'Unassigned',
      work_date: row.date,
      outbound_calls: row.outbound_calls || 0,
      talk_minutes: row.talk_minutes || 0,
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
    }));

    console.log(`Dashboard daily [${authResult.mode}]: Found ${rows.length} rows for agency ${agencySlug || agencyId} on ${workDate} with role ${role}`);

    return new Response(
      JSON.stringify({ rows }),
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
