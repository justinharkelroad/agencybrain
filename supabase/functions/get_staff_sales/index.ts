import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
}

interface Sale {
  id: string;
  sale_date: string;
  customer_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
  team_member_id: string;
  sale_policies: SalePolicy[];
}

interface TeamMember {
  id: string;
  name: string;
}

interface LeaderboardEntry {
  team_member_id: string;
  name: string;
  premium: number;
  items: number;
  points: number;
  policies: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get session token from header
    const sessionToken = req.headers.get('x-staff-session');
    
    if (!sessionToken) {
      console.error('No session token provided');
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
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        staff_user_id,
        expires_at,
        is_active,
        staff_users!inner(
          id,
          agency_id,
          team_member_id,
          name,
          display_name
        )
      `)
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const staffUser = session.staff_users;
    const agencyId = staffUser.agency_id;
    const teamMemberId = staffUser.team_member_id;

    if (!agencyId) {
      return new Response(JSON.stringify({ error: 'Staff user has no agency' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { date_start, date_end, include_leaderboard = true } = body;

    console.log('Fetching sales for agency:', agencyId, 'team_member:', teamMemberId);
    console.log('Date range:', date_start, 'to', date_end);

    // Fetch personal sales (if team_member_id exists)
    let personalSales: Sale[] = [];
    if (teamMemberId) {
      const personalQuery = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          customer_name,
          total_premium,
          total_items,
          total_points,
          team_member_id,
          sale_policies(id, policy_type_name)
        `)
        .eq('agency_id', agencyId)
        .eq('team_member_id', teamMemberId);

      if (date_start) personalQuery.gte('sale_date', date_start);
      if (date_end) personalQuery.lte('sale_date', date_end);
      personalQuery.order('sale_date', { ascending: false });

      const { data, error } = await personalQuery;
      if (error) {
        console.error('Error fetching personal sales:', error);
      } else {
        personalSales = (data || []) as Sale[];
      }
    }

    // Calculate personal totals
    const totals = personalSales.reduce(
      (acc, sale) => ({
        premium: acc.premium + (sale.total_premium || 0),
        items: acc.items + (sale.total_items || 0),
        points: acc.points + (sale.total_points || 0),
        policies: acc.policies + (sale.sale_policies?.length || 0),
      }),
      { premium: 0, items: 0, points: 0, policies: 0 }
    );

    console.log('Personal totals:', totals);

    // Fetch leaderboard data if requested
    let leaderboard: LeaderboardEntry[] = [];
    
    if (include_leaderboard) {
      // Get all active team members for this agency
      const { data: teamMembers, error: tmError } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId)
        .eq('status', 'active');

      if (tmError) {
        console.error('Error fetching team members:', tmError);
      }

      console.log('Found team members:', teamMembers?.length || 0);

      // Get all sales for the agency in date range
      const allSalesQuery = supabase
        .from('sales')
        .select(`
          team_member_id,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq('agency_id', agencyId);

      if (date_start) allSalesQuery.gte('sale_date', date_start);
      if (date_end) allSalesQuery.lte('sale_date', date_end);

      const { data: allSales, error: salesError } = await allSalesQuery;
      
      if (salesError) {
        console.error('Error fetching all sales:', salesError);
      }

      console.log('Found sales for leaderboard:', allSales?.length || 0);

      // Aggregate by team member
      const aggregated: Record<string, LeaderboardEntry> = {};

      for (const tm of (teamMembers || []) as TeamMember[]) {
        aggregated[tm.id] = {
          team_member_id: tm.id,
          name: tm.name,
          premium: 0,
          items: 0,
          points: 0,
          policies: 0,
        };
      }

      for (const sale of allSales || []) {
        const tmId = sale.team_member_id;
        if (tmId && aggregated[tmId]) {
          aggregated[tmId].premium += sale.total_premium || 0;
          aggregated[tmId].items += sale.total_items || 0;
          aggregated[tmId].points += sale.total_points || 0;
          aggregated[tmId].policies += (sale.sale_policies as any[])?.length || 0;
        }
      }

      leaderboard = Object.values(aggregated);
      console.log('Leaderboard entries:', leaderboard.length);
    }

    return new Response(JSON.stringify({
      personal_sales: personalSales,
      totals,
      leaderboard,
      team_member_id: teamMemberId,
      agency_id: agencyId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get_staff_sales:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
