import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface AssignLeadSourceRequest {
  household_id?: string;
  household_ids?: string[];
  lead_source_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Validate staff session
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

    // Step 2: Verify staff session
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', nowISO)
      .maybeSingle();

    if (sessionError || !session) {
      console.error('[staff_assign_lead_source] Invalid or expired session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('[staff_assign_lead_source] Staff user lookup failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Parse and validate request body
    const body: AssignLeadSourceRequest = await req.json();

    if (!body.lead_source_id) {
      return new Response(
        JSON.stringify({ error: 'lead_source_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Support both single and bulk assignment
    const householdIds: string[] = body.household_ids
      ? body.household_ids
      : body.household_id
        ? [body.household_id]
        : [];

    if (householdIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'household_id or household_ids is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Verify lead source belongs to the staff user's agency
    const { data: leadSource, error: lsError } = await supabase
      .from('lead_sources')
      .select('id, agency_id')
      .eq('id', body.lead_source_id)
      .eq('is_active', true)
      .single();

    if (lsError || !leadSource) {
      return new Response(
        JSON.stringify({ error: 'Lead source not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (leadSource.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Verify all households belong to the staff user's agency
    const { data: households, error: hhError } = await supabase
      .from('lqs_households')
      .select('id, agency_id')
      .in('id', householdIds);

    if (hhError) {
      console.error('[staff_assign_lead_source] Household lookup failed:', hhError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify households' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invalidHouseholds = (households || []).filter(h => h.agency_id !== staffUser.agency_id);
    if (invalidHouseholds.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Access denied to one or more households' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((households || []).length !== householdIds.length) {
      return new Response(
        JSON.stringify({ error: 'One or more households not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 7: Update households
    const { error: updateError } = await supabase
      .from('lqs_households')
      .update({
        lead_source_id: body.lead_source_id,
        needs_attention: false,
      })
      .in('id', householdIds)
      .eq('agency_id', staffUser.agency_id);

    if (updateError) {
      console.error('[staff_assign_lead_source] Update failed:', updateError);
      throw updateError;
    }

    console.log(`[staff_assign_lead_source] Assigned lead source to ${householdIds.length} households`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: householdIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[staff_assign_lead_source] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to assign lead source' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
