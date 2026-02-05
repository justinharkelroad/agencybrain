import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface AddPolicyRequest {
  household_id: string;
  sale_date: string;
  product_type: string;
  premium: string;
  items_sold?: number;
  policies_sold?: number;
  policy_number?: string;
  team_member_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Staff session required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.error('[staff_add_policy] Session lookup failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session.is_valid || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('[staff_add_policy] Staff user lookup failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AddPolicyRequest = await req.json();

    if (!body.household_id) {
      return new Response(
        JSON.stringify({ error: 'household_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!body.sale_date) {
      return new Response(
        JSON.stringify({ error: 'sale_date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!body.product_type) {
      return new Response(
        JSON.stringify({ error: 'product_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!body.premium || isNaN(parseFloat(body.premium)) || parseFloat(body.premium) <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid premium is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure household belongs to this agency
    const { data: household, error: householdError } = await supabase
      .from('lqs_households')
      .select('id, agency_id')
      .eq('id', body.household_id)
      .single();

    if (householdError || !household) {
      return new Response(
        JSON.stringify({ error: 'Household not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (household.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let teamMemberId = staffUser.team_member_id;
    if (body.team_member_id) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id, agency_id')
        .eq('id', body.team_member_id)
        .maybeSingle();

      if (teamMember?.agency_id === staffUser.agency_id) {
        teamMemberId = teamMember.id;
      }
    }

    const premiumCents = Math.round(parseFloat(body.premium) * 100);

    const { error: insertError } = await supabase
      .from('lqs_sales')
      .insert({
        household_id: body.household_id,
        agency_id: staffUser.agency_id,
        team_member_id: teamMemberId,
        sale_date: body.sale_date,
        product_type: body.product_type,
        items_sold: body.items_sold ?? 1,
        policies_sold: body.policies_sold ?? 1,
        premium_cents: premiumCents,
        policy_number: body.policy_number || null,
        source: 'manual',
      });

    if (insertError) {
      console.error('[staff_add_policy] Insert failed:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[staff_add_policy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to add policy' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
