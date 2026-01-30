import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  policy_number: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

interface Sale {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_zip: string | null;
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
  households: number;
}

interface Trends {
  premium: number | null;
  items: number | null;
  points: number | null;
  policies: number | null;
  households: number | null;
}

interface Streak {
  current: number;
  longest: number;
  last_sale_date: string | null;
}

interface MyRank {
  rank: number;
  total_producers: number;
  ranked_by: string;
}

// Helper: Calculate percent change
function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Helper: Get previous month date range
function getPreviousMonthRange(dateStart: string, dateEnd: string): { prevStart: string; prevEnd: string } {
  const start = new Date(dateStart);
  const end = new Date(dateEnd);

  // Move to previous month
  start.setMonth(start.getMonth() - 1);
  end.setMonth(end.getMonth() - 1);

  // Adjust end date to last day of previous month
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(end.getDate(), lastDay));

  return {
    prevStart: start.toISOString().split('T')[0],
    prevEnd: end.toISOString().split('T')[0],
  };
}

// Helper: Calculate streak from sale dates
function calculateStreak(saleDates: string[]): Streak {
  if (saleDates.length === 0) {
    return { current: 0, longest: 0, last_sale_date: null };
  }

  // Sort dates descending (most recent first)
  const uniqueDates = [...new Set(saleDates)].sort((a, b) => b.localeCompare(a));
  const lastSaleDate = uniqueDates[0];

  // Calculate current streak (consecutive days from most recent)
  let currentStreak = 1;
  const today = new Date().toISOString().split('T')[0];

  // If last sale wasn't today or yesterday, streak is broken
  const lastSale = new Date(lastSaleDate);
  const todayDate = new Date(today);
  const daysDiff = Math.floor((todayDate.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 1) {
    // Streak is broken (more than 1 day gap)
    currentStreak = 0;
  } else {
    // Count consecutive days backwards
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diff = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak ever
  let longestStreak = 1;
  let tempStreak = 1;

  // Sort ascending for longest streak calculation
  const sortedAsc = [...uniqueDates].sort((a, b) => a.localeCompare(b));

  for (let i = 1; i < sortedAsc.length; i++) {
    const prevDate = new Date(sortedAsc[i - 1]);
    const currDate = new Date(sortedAsc[i]);
    const diff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return {
    current: currentStreak,
    longest: Math.max(longestStreak, currentStreak),
    last_sale_date: lastSaleDate,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get session token from header
    const sessionToken = req.headers.get('x-staff-session');
    
    // Debug logging
    console.log('Session token received:', sessionToken ? 'yes' : 'no');
    console.log('Session token prefix:', sessionToken?.substring(0, 20) + '...');
    
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

    // Verify session - using is_valid (correct column name, not is_active)
    const nowISO = new Date().toISOString();
    console.log('Checking session with expires_at >', nowISO);
    
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', nowISO)
      .maybeSingle();

    console.log('Session query result:', JSON.stringify(session));
    console.log('Session query error:', sessionError ? JSON.stringify(sessionError) : 'none');

    // Check for schema errors (like column not existing) - return 500 not 401
    if (sessionError) {
      if (sessionError.code === '42703') {
        console.error('Schema error - column does not exist:', sessionError);
        return new Response(JSON.stringify({ 
          error: 'Schema error', 
          details: sessionError.message,
          code: sessionError.code 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.error('Session verification failed:', sessionError);
      return new Response(JSON.stringify({ error: 'Unauthorized - session error' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session) {
      console.error('No valid session found for token');
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id, display_name')
      .eq('id', session.staff_user_id)
      .single();

    console.log('Staff user query result:', JSON.stringify(staffUser));
    console.log('Staff user query error:', staffError ? JSON.stringify(staffError) : 'none');

    if (staffError) {
      if (staffError.code === '42703') {
        console.error('Schema error - column does not exist:', staffError);
        return new Response(JSON.stringify({ 
          error: 'Schema error', 
          details: staffError.message,
          code: staffError.code 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.error('Staff user lookup failed:', staffError);
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user error' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!staffUser) {
      console.error('Staff user not found for id:', session.staff_user_id);
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Session verified for staff user:', staffUser.display_name);

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
    const { date_start, date_end, include_leaderboard = true, scope = "personal", business_filter = "all" } = body;

    console.log('Fetching sales for agency:', agencyId, 'team_member:', teamMemberId, 'scope:', scope, 'business_filter:', business_filter);
    console.log('Date range:', date_start, 'to', date_end);

    // Helper to apply business filter to a query
    const applyBusinessFilter = (query: any) => {
      if (business_filter === "regular") {
        return query.is("brokered_carrier_id", null);
      } else if (business_filter === "brokered") {
        return query.not("brokered_carrier_id", "is", null);
      }
      return query; // "all" - no filter
    };

    // Fetch lead sources for the agency
    const { data: leadSources, error: leadSourcesError } = await supabase
      .from('lead_sources')
      .select('id, name')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (leadSourcesError) {
      console.error('Error fetching lead sources:', leadSourcesError);
    }
    console.log('Lead sources found:', leadSources?.length || 0);

    // Determine if we're fetching personal or team-wide sales
    const isTeamScope = scope === "team";

    // Fetch sales based on scope
    let salesForTotals: Sale[] = [];
    let personalSales: Sale[] = [];
    
    if (isTeamScope) {
      // For team scope, fetch all agency sales for totals (no team_member filter)
      let teamQuery = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          customer_name,
          customer_email,
          customer_phone,
          customer_zip,
          total_premium,
          total_items,
          total_points,
          team_member_id,
          lead_source_id,
          brokered_carrier_id,
          sale_policies(id, policy_type_name, policy_number, total_premium, total_items, total_points)
        `)
        .eq('agency_id', agencyId);

      if (date_start) teamQuery = teamQuery.gte('sale_date', date_start);
      if (date_end) teamQuery = teamQuery.lte('sale_date', date_end);
      teamQuery = applyBusinessFilter(teamQuery);
      teamQuery = teamQuery.order('sale_date', { ascending: false });

      const { data, error } = await teamQuery;
      if (error) {
        console.error('Error fetching team sales:', error);
      } else {
        salesForTotals = (data || []) as Sale[];
        console.log('Team sales found:', salesForTotals.length);
      }
    } else {
      // For personal scope, fetch only the staff member's sales
      if (teamMemberId) {
        let personalQuery = supabase
          .from('sales')
          .select(`
            id,
            sale_date,
            customer_name,
            customer_email,
            customer_phone,
            customer_zip,
            total_premium,
            total_items,
            total_points,
            team_member_id,
            lead_source_id,
            brokered_carrier_id,
            sale_policies(id, policy_type_name, policy_number, total_premium, total_items, total_points)
          `)
          .eq('agency_id', agencyId)
          .eq('team_member_id', teamMemberId);

        if (date_start) personalQuery = personalQuery.gte('sale_date', date_start);
        if (date_end) personalQuery = personalQuery.lte('sale_date', date_end);
        personalQuery = applyBusinessFilter(personalQuery);
        personalQuery = personalQuery.order('sale_date', { ascending: false });

        const { data, error } = await personalQuery;
        if (error) {
          console.error('Error fetching personal sales:', error);
        } else {
          personalSales = (data || []) as Sale[];
          salesForTotals = personalSales;
          console.log('Personal sales found:', personalSales.length);
        }
      }
    }

    // Calculate totals including unique households
    const uniqueCustomers = new Set(
      salesForTotals
        .map(sale => sale.customer_name?.toLowerCase().trim())
        .filter(Boolean)
    );

    const totals = salesForTotals.reduce(
      (acc, sale) => ({
        premium: acc.premium + (sale.total_premium || 0),
        items: acc.items + (sale.total_items || 0),
        points: acc.points + (sale.total_points || 0),
        policies: acc.policies + (sale.sale_policies?.length || 0),
        households: uniqueCustomers.size,
      }),
      { premium: 0, items: 0, points: 0, policies: 0, households: 0 }
    );

    console.log('Totals (scope=' + scope + '):', JSON.stringify(totals));

    // Fetch leaderboard data if requested (only for personal scope to avoid redundant work)
    let leaderboard: LeaderboardEntry[] = [];
    
    if (include_leaderboard && !isTeamScope) {
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
      let allSalesQuery = supabase
        .from('sales')
        .select(`
          team_member_id,
          customer_name,
          total_premium,
          total_items,
          total_points,
          brokered_carrier_id,
          sale_policies(id)
        `)
        .eq('agency_id', agencyId);

      if (date_start) allSalesQuery = allSalesQuery.gte('sale_date', date_start);
      if (date_end) allSalesQuery = allSalesQuery.lte('sale_date', date_end);
      allSalesQuery = applyBusinessFilter(allSalesQuery);

      const { data: allSales, error: salesError } = await allSalesQuery;
      
      if (salesError) {
        console.error('Error fetching all sales:', salesError);
      }

      console.log('Found sales for leaderboard:', allSales?.length || 0);

      // Aggregate by team member
      const aggregated: Record<string, LeaderboardEntry & { customerNames: Set<string> }> = {};

      for (const tm of (teamMembers || []) as TeamMember[]) {
        aggregated[tm.id] = {
          team_member_id: tm.id,
          name: tm.name,
          premium: 0,
          items: 0,
          points: 0,
          policies: 0,
          households: 0,
          customerNames: new Set(),
        };
      }

      for (const sale of allSales || []) {
        const tmId = sale.team_member_id;
        if (tmId && aggregated[tmId]) {
          aggregated[tmId].premium += sale.total_premium || 0;
          aggregated[tmId].items += sale.total_items || 0;
          aggregated[tmId].points += sale.total_points || 0;
          aggregated[tmId].policies += (sale.sale_policies as any[])?.length || 0;
          
          // Track unique households
          const customerName = (sale as any).customer_name?.toLowerCase().trim();
          if (customerName) {
            aggregated[tmId].customerNames.add(customerName);
          }
        }
      }

      // Convert to leaderboard entries (calculate households from Set size)
      leaderboard = Object.values(aggregated).map(entry => ({
        team_member_id: entry.team_member_id,
        name: entry.name,
        premium: entry.premium,
        items: entry.items,
        points: entry.points,
        policies: entry.policies,
        households: entry.customerNames.size,
      }));
      console.log('Leaderboard entries:', leaderboard.length);
    }

    // === NEW: Calculate trends (month-over-month comparison) ===
    let trends: Trends = {
      premium: null,
      items: null,
      points: null,
      policies: null,
      households: null,
    };

    if (date_start && date_end && !isTeamScope && teamMemberId) {
      const { prevStart, prevEnd } = getPreviousMonthRange(date_start, date_end);
      console.log('Fetching previous month data:', prevStart, 'to', prevEnd);

      let prevQuery = supabase
        .from('sales')
        .select(`
          total_premium,
          total_items,
          total_points,
          customer_name,
          brokered_carrier_id,
          sale_policies(id)
        `)
        .eq('agency_id', agencyId)
        .eq('team_member_id', teamMemberId)
        .gte('sale_date', prevStart)
        .lte('sale_date', prevEnd);

      prevQuery = applyBusinessFilter(prevQuery);

      const { data: prevSales, error: prevError } = await prevQuery;

      if (!prevError && prevSales) {
        const prevUniqueCustomers = new Set(
          prevSales
            .map(sale => (sale as any).customer_name?.toLowerCase().trim())
            .filter(Boolean)
        );

        const prevTotals = prevSales.reduce(
          (acc, sale) => ({
            premium: acc.premium + ((sale as any).total_premium || 0),
            items: acc.items + ((sale as any).total_items || 0),
            points: acc.points + ((sale as any).total_points || 0),
            policies: acc.policies + ((sale as any).sale_policies?.length || 0),
          }),
          { premium: 0, items: 0, points: 0, policies: 0 }
        );

        trends = {
          premium: calcPercentChange(totals.premium, prevTotals.premium),
          items: calcPercentChange(totals.items, prevTotals.items),
          points: calcPercentChange(totals.points, prevTotals.points),
          policies: calcPercentChange(totals.policies, prevTotals.policies),
          households: calcPercentChange(totals.households, prevUniqueCustomers.size),
        };

        console.log('Trends calculated:', JSON.stringify(trends));
      }
    }

    // === NEW: Calculate streak (consecutive days with sales) ===
    let streak: Streak = { current: 0, longest: 0, last_sale_date: null };

    if (!isTeamScope && teamMemberId) {
      // Get all sale dates for this team member (last 90 days for performance)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const streakStartDate = ninetyDaysAgo.toISOString().split('T')[0];

      let streakQuery = supabase
        .from('sales')
        .select('sale_date, brokered_carrier_id')
        .eq('agency_id', agencyId)
        .eq('team_member_id', teamMemberId)
        .gte('sale_date', streakStartDate);

      streakQuery = applyBusinessFilter(streakQuery);
      streakQuery = streakQuery.order('sale_date', { ascending: false });

      const { data: streakSales, error: streakError } = await streakQuery;

      if (!streakError && streakSales) {
        const saleDates = streakSales.map(s => s.sale_date);
        streak = calculateStreak(saleDates);
        console.log('Streak calculated:', JSON.stringify(streak));
      }
    }

    // === NEW: Calculate my_rank from leaderboard ===
    let myRank: MyRank | null = null;

    if (leaderboard.length > 0 && teamMemberId) {
      // Sort by items (default ranking metric)
      const sortedByItems = [...leaderboard].sort((a, b) => b.items - a.items);
      const myIndex = sortedByItems.findIndex(e => e.team_member_id === teamMemberId);

      if (myIndex !== -1) {
        myRank = {
          rank: myIndex + 1,
          total_producers: sortedByItems.length,
          ranked_by: 'items',
        };
        console.log('My rank calculated:', JSON.stringify(myRank));
      }
    }

    console.log('Returning success response');

    return new Response(JSON.stringify({
      personal_sales: isTeamScope ? [] : personalSales,
      totals,
      leaderboard,
      team_member_id: teamMemberId,
      agency_id: agencyId,
      lead_sources: leadSources || [],
      scope,
      // NEW fields
      trends,
      streak,
      my_rank: myRank,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get_staff_sales:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
