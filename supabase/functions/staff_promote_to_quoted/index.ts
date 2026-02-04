import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface PromoteToQuotedRequest {
  household_id: string;
  create_placeholder_quote?: boolean;
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

    // Create supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 2: Verify staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.error('[staff_promote_to_quoted] Session lookup failed:', sessionError);
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

    // Step 3: Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('[staff_promote_to_quoted] Staff user lookup failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Parse and validate request body
    const body: PromoteToQuotedRequest = await req.json();
    console.log('[staff_promote_to_quoted] Request for household:', body.household_id);

    if (!body.household_id) {
      return new Response(
        JSON.stringify({ error: 'Household ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Fetch and validate household (include lead_source_id and contact_id for needs_attention and activity logging)
    const { data: household, error: householdError } = await supabase
      .from('lqs_households')
      .select('id, agency_id, status, first_name, last_name, lead_source_id, contact_id, team_member_id')
      .eq('id', body.household_id)
      .single();

    if (householdError || !household) {
      console.error('[staff_promote_to_quoted] Household lookup failed:', householdError);
      return new Response(
        JSON.stringify({ error: 'Household not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff has access to this household's agency
    if (household.agency_id !== staffUser.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already quoted or sold
    if (household.status === 'quoted') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already quoted', household_id: household.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (household.status === 'sold') {
      return new Response(
        JSON.stringify({ error: 'Cannot change status of sold household' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Determine if needs attention (missing lead source)
    const needsAttention = !household.lead_source_id;
    const assignToTeamMemberId = staffUser.team_member_id || household.team_member_id;

    // Step 6: Update household status to 'quoted'
    const { error: updateError } = await supabase
      .from('lqs_households')
      .update({
        status: 'quoted',
        first_quote_date: today,
        team_member_id: assignToTeamMemberId,
        needs_attention: needsAttention,
        attention_reason: needsAttention ? 'missing_lead_source' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.household_id);

    if (updateError) {
      console.error('[staff_promote_to_quoted] Update failed:', updateError);
      throw updateError;
    }

    // Step 7: Optionally create placeholder quote for tracking
    if (body.create_placeholder_quote !== false) {
      const { error: quoteError } = await supabase
        .from('lqs_quotes')
        .insert({
          household_id: body.household_id,
          agency_id: staffUser.agency_id,
          team_member_id: staffUser.team_member_id,
          quote_date: today,
          product_type: 'Bundle',
          items_quoted: 1,
          premium_cents: 0,
          source: 'manual',
        });

      if (quoteError) {
        // Log but don't fail - the status update is the primary goal
        console.warn('[staff_promote_to_quoted] Placeholder quote creation failed:', quoteError);
      }
    }

    // Step 8: Log activity if contact exists
    if (household.contact_id) {
      // Get staff user display name for activity log
      const { data: staffDetails } = await supabase
        .from('staff_users')
        .select('first_name, last_name')
        .eq('id', staffUser.id)
        .single();

      const staffDisplayName = staffDetails
        ? `${staffDetails.first_name || ''} ${staffDetails.last_name || ''}`.trim() || 'Staff User'
        : 'Staff User';

      const { error: activityError } = await supabase
        .from('contact_activities')
        .insert({
          contact_id: household.contact_id,
          agency_id: staffUser.agency_id,
          team_member_id: assignToTeamMemberId,
          activity_type: 'lqs_status_change',
          description: `Moved to Quoted by ${staffDisplayName}`,
          metadata: {
            previous_status: household.status,
            new_status: 'quoted',
            performed_by: staffDisplayName,
            staff_user_id: staffUser.id,
          },
        });

      if (activityError) {
        console.warn('[staff_promote_to_quoted] Activity log failed:', activityError);
      }
    }

    console.log('[staff_promote_to_quoted] Success - household:', body.household_id);

    return new Response(
      JSON.stringify({
        success: true,
        household_id: body.household_id,
        message: `${household.first_name} ${household.last_name} moved to Quoted`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[staff_promote_to_quoted] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to promote to quoted' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
