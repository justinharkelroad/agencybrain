import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LqsLeadSource {
  id: string;
  name: string;
  is_self_generated: boolean;
}

interface LqsObjection {
  id: string;
  name: string;
}

interface LqsTeamMember {
  id: string;
  name: string;
}

interface LqsQuote {
  id: string;
  household_id: string;
  quote_date: string;
  product_type: string;
  items_quoted: number;
  premium_cents: number | null;
  source: string;
}

interface LqsSale {
  id: string;
  household_id: string;
  sale_date: string;
  product_type: string;
  items_sold: number;
  policies_sold: number;
  premium_cents: number;
  policy_number: string | null;
  source: string;
  source_reference_id: string | null;
  linked_quote_id: string | null;
}

interface LqsHousehold {
  id: string;
  agency_id: string;
  household_key: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string[] | null;
  zip_code: string | null;
  lead_source_id: string | null;
  team_member_id: string | null;
  objection_id: string | null;
  status: string;
  first_quote_date: string | null;
  sold_date: string | null;
  needs_attention: boolean;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  quotes: LqsQuote[];
  sales: LqsSale[];
  lead_source: LqsLeadSource | null;
  team_member: LqsTeamMember | null;
  objection: LqsObjection | null;
}

interface LqsMetrics {
  totalQuotes: number;
  selfGenerated: number;
  sold: number;
  needsAttention: number;
  leadsCount: number;
  quotedCount: number;
  soldCount: number;
  leadsToQuotedRate: number;
  quotedToSoldRate: number;
  totalPremiumQuotedCents: number;
  totalPremiumSoldCents: number;
  avgPremiumSoldCents: number;
  quotedNeedsAttention: number;
  soldNeedsAttention: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', nowISO)
      .maybeSingle();

    if (sessionError) {
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
      .select('id, agency_id, team_member_id, display_name, is_active')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('Staff user lookup failed:', staffError);
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!staffUser.is_active) {
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user deactivated' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = staffUser.agency_id;
    const teamMemberId = staffUser.team_member_id;

    if (!agencyId) {
      return new Response(JSON.stringify({ error: 'Staff user has no agency' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const { date_start, date_end, status_filter, search_term } = body;

    console.log('Fetching LQS data for agency:', agencyId, 'team_member:', teamMemberId);

    // Fetch all households with relations using pagination to bypass 1000 row limit
    const PAGE_SIZE = 1000;
    const MAX_FETCH = 20000;
    const allHouseholds: LqsHousehold[] = [];

    for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
      let query = supabase
        .from('lqs_households')
        .select(`
          id,
          agency_id,
          household_key,
          first_name,
          last_name,
          email,
          phone,
          zip_code,
          lead_source_id,
          team_member_id,
          objection_id,
          status,
          first_quote_date,
          sold_date,
          needs_attention,
          contact_id,
          created_at,
          updated_at,
          lead_source:lead_sources!lqs_households_lead_source_id_fkey(id, name, is_self_generated),
          team_member:team_members(id, name),
          objection:lqs_objections(id, name),
          quotes:lqs_quotes(id, household_id, quote_date, product_type, items_quoted, premium_cents, source),
          sales:lqs_sales(id, household_id, sale_date, product_type, items_sold, policies_sold, premium_cents, policy_number, source, source_reference_id, linked_quote_id)
        `)
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      // Apply date filter if provided
      if (date_start) {
        query = query.gte('first_quote_date', date_start);
      }
      if (date_end) {
        query = query.lte('first_quote_date', date_end);
      }

      // Apply status filter if provided
      if (status_filter && status_filter !== 'all') {
        query = query.eq('status', status_filter);
      }

      // Apply search term if provided
      if (search_term) {
        query = query.or(`first_name.ilike.%${search_term}%,last_name.ilike.%${search_term}%,email.ilike.%${search_term}%`);
      }

      const { data: page, error: pageError } = await query;

      if (pageError) {
        console.error('Error fetching households page:', pageError);
        return new Response(JSON.stringify({ error: 'Failed to fetch LQS data', details: pageError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!page || page.length === 0) break;

      allHouseholds.push(...(page as LqsHousehold[]));

      // If we got less than PAGE_SIZE, we've reached the end
      if (page.length < PAGE_SIZE) break;
    }

    const households = allHouseholds;
    console.log('Fetched households:', households.length);

    // Fetch lead sources for the agency
    const { data: leadSources, error: leadSourcesError } = await supabase
      .from('lead_sources')
      .select('id, name, is_self_generated')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (leadSourcesError) {
      console.error('Error fetching lead sources:', leadSourcesError);
    }

    // Fetch team members for the agency
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from('team_members')
      .select('id, name, email')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .order('name');

    if (teamMembersError) {
      console.error('Error fetching team members:', teamMembersError);
    }

    // Fetch global objections (not agency-scoped)
    const { data: objections, error: objectionsError } = await supabase
      .from('lqs_objections')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (objectionsError) {
      console.error('Error fetching objections:', objectionsError);
    }

    // Calculate metrics
    const householdList = (households || []) as LqsHousehold[];

    const leadsCount = householdList.filter(h => h.status === 'lead').length;
    const quotedCount = householdList.filter(h => h.status === 'quoted').length;
    const soldCount = householdList.filter(h => h.status === 'sold').length;

    const totalQuotes = householdList.reduce((sum, h) => sum + (h.quotes?.length || 0), 0);
    const selfGenerated = householdList.filter(h => h.lead_source?.is_self_generated === true).length;
    const needsAttention = householdList.filter(h => h.needs_attention).length;

    const quotedNeedsAttention = householdList.filter(h => h.status === 'quoted' && h.needs_attention).length;
    const soldNeedsAttention = householdList.filter(h => h.status === 'sold' && h.needs_attention).length;

    // Calculate conversion rates
    const totalLeadsAndQuoted = leadsCount + quotedCount + soldCount;
    const leadsToQuotedRate = totalLeadsAndQuoted > 0
      ? ((quotedCount + soldCount) / totalLeadsAndQuoted) * 100
      : 0;
    const quotedToSoldRate = (quotedCount + soldCount) > 0
      ? (soldCount / (quotedCount + soldCount)) * 100
      : 0;

    // Calculate premium totals
    const totalPremiumQuotedCents = householdList
      .filter(h => h.status === 'quoted')
      .reduce((sum, h) => sum + (h.quotes?.reduce((qSum, q) => qSum + (q.premium_cents || 0), 0) || 0), 0);

    const soldHouseholds = householdList.filter(h => h.status === 'sold');
    const totalPremiumSoldCents = soldHouseholds
      .reduce((sum, h) => sum + (h.sales?.reduce((sSum, s) => sSum + (s.premium_cents || 0), 0) || 0), 0);
    const avgPremiumSoldCents = soldCount > 0 ? Math.round(totalPremiumSoldCents / soldCount) : 0;

    const metrics: LqsMetrics = {
      totalQuotes,
      selfGenerated,
      sold: soldCount,
      needsAttention,
      leadsCount,
      quotedCount,
      soldCount,
      leadsToQuotedRate,
      quotedToSoldRate,
      totalPremiumQuotedCents,
      totalPremiumSoldCents,
      avgPremiumSoldCents,
      quotedNeedsAttention,
      soldNeedsAttention,
    };

    console.log('Returning LQS data with', householdList.length, 'households');

    return new Response(JSON.stringify({
      households: householdList,
      metrics,
      lead_sources: leadSources || [],
      team_members: teamMembers || [],
      objections: objections || [],
      team_member_id: teamMemberId,
      agency_id: agencyId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get_staff_lqs_data:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
