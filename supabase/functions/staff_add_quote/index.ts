import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface ProductEntry {
  productType: string;
  premium: string;
  items: string;
  issued_policy_number?: string;
}

interface AddQuoteRequest {
  first_name: string;
  last_name: string;
  zip_code: string;
  phone?: string;
  email?: string;
  lead_source_id?: string;
  quote_date: string;
  notes?: string;
  products: ProductEntry[];
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
      console.error('[staff_add_quote] Session lookup failed:', sessionError);
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
      console.error('[staff_add_quote] Staff user lookup failed:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staffUser.team_member_id) {
      return new Response(
        JSON.stringify({ error: 'Staff user not linked to team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Parse and validate request body
    const body: AddQuoteRequest = await req.json();
    console.log('[staff_add_quote] Creating quote for staff:', staffUser.id);

    if (!body.first_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'First name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.last_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Last name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.zip_code?.trim() || body.zip_code.length !== 5) {
      return new Response(
        JSON.stringify({ error: 'Valid 5-digit ZIP code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.products || body.products.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one product is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Generate household key (same format as AddQuoteModal)
    const householdKey = `${body.last_name.trim().toUpperCase()}_${body.first_name.trim().toUpperCase()}_${body.zip_code.trim()}`;

    // Step 6: Find or create household
    const { data: existingHousehold } = await supabase
      .from('lqs_households')
      .select('id, status')
      .eq('agency_id', staffUser.agency_id)
      .eq('household_key', householdKey)
      .maybeSingle();

    let householdId: string;

    if (existingHousehold) {
      householdId = existingHousehold.id;
      console.log('[staff_add_quote] Found existing household:', householdId);

      // Update household - change status to quoted if was lead
      const updates: Record<string, unknown> = {};
      if (existingHousehold.status === 'lead') {
        updates.status = 'quoted';
        updates.first_quote_date = body.quote_date;
      }
      if (body.phone) updates.phone = [body.phone.trim()];
      if (body.email) updates.email = body.email;
      if (body.lead_source_id) {
        updates.lead_source_id = body.lead_source_id;
        updates.needs_attention = false;
      }
      updates.team_member_id = staffUser.team_member_id;
      if (body.notes) updates.notes = body.notes;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('lqs_households')
          .update(updates)
          .eq('id', householdId);

        if (updateError) {
          console.error('[staff_add_quote] Household update failed:', updateError);
          throw updateError;
        }
      }
    } else {
      // Create new household
      console.log('[staff_add_quote] Creating new household:', householdKey);
      const { data: newHousehold, error: insertError } = await supabase
        .from('lqs_households')
        .insert({
          agency_id: staffUser.agency_id,
          household_key: householdKey,
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          zip_code: body.zip_code.trim(),
          phone: body.phone ? [body.phone.trim()] : null,
          email: body.email || null,
          status: 'quoted',
          first_quote_date: body.quote_date,
          lead_source_id: body.lead_source_id || null,
          team_member_id: staffUser.team_member_id,
          needs_attention: !body.lead_source_id,
          notes: body.notes || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[staff_add_quote] Household insert failed:', insertError);
        throw insertError;
      }
      householdId = newHousehold.id;
    }

    // Step 7: Create quote records for each product
    const quoteInserts = body.products.map((p) => ({
      household_id: householdId,
      agency_id: staffUser.agency_id,
      product_type: p.productType,
      premium_cents: Math.round(parseFloat(p.premium) * 100),
      quote_date: body.quote_date,
      team_member_id: staffUser.team_member_id,
      items_quoted: parseInt(p.items, 10) || 1,
      issued_policy_number: p.issued_policy_number || null,
      source: 'manual' as const,
    }));

    const { error: quoteError } = await supabase
      .from('lqs_quotes')
      .insert(quoteInserts);

    if (quoteError) {
      console.error('[staff_add_quote] Quote insert failed:', quoteError);
      throw quoteError;
    }

    console.log('[staff_add_quote] Success - household:', householdId, 'quotes:', quoteInserts.length);

    return new Response(
      JSON.stringify({
        success: true,
        household_id: householdId,
        quotes_created: quoteInserts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[staff_add_quote] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to add quote' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
