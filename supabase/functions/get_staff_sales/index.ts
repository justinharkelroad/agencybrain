import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { date_start, date_end, include_leaderboard = true } = body;

    console.log('Fetching sales for agency:', agencyId, 'team_member:', teamMemberId);
    console.log('Date range:', date_start, 'to', date_end);

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

    // Fetch personal sales (if team_member_id exists)
    let personalSales: Sale[] = [];
    if (teamMemberId) {
      const personalQuery = supabase
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
          sale_policies(id, policy_type_name, policy_number, total_premium, total_items, total_points)
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
        console.log('Personal sales found:', personalSales.length);
      }
    }

    // Calculate personal totals including unique households
    const uniqueCustomers = new Set(
      personalSales
        .map(sale => sale.customer_name?.toLowerCase().trim())
        .filter(Boolean)
    );

    const totals = personalSales.reduce(
      (acc, sale) => ({
        premium: acc.premium + (sale.total_premium || 0),
        items: acc.items + (sale.total_items || 0),
        points: acc.points + (sale.total_points || 0),
        policies: acc.policies + (sale.sale_policies?.length || 0),
        households: uniqueCustomers.size,
      }),
      { premium: 0, items: 0, points: 0, policies: 0, households: 0 }
    );

    console.log('Personal totals:', JSON.stringify(totals));

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
          customer_name,
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

    console.log('Returning success response');
    
    return new Response(JSON.stringify({
      personal_sales: personalSales,
      totals,
      leaderboard,
      team_member_id: teamMemberId,
      agency_id: agencyId,
      lead_sources: leadSources || [],
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
