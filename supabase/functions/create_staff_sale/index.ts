import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface LineItem {
  product_type_id: string | null;
  product_type_name: string;
  item_count: number;
  premium: number;
  points: number;
  is_vc_qualifying: boolean;
}

interface Policy {
  product_type_id: string | null;
  policy_type_name: string;
  policy_number?: string;
  effective_date: string;
  is_vc_qualifying: boolean;
  items: LineItem[];
}

interface CreateSaleRequest {
  lead_source_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_zip?: string;
  sale_date: string;
  effective_date: string;
  expiration_date?: string;
  source: string;
  source_details?: Record<string, unknown>;
  policies: Policy[];
  // Totals (pre-calculated by client)
  total_policies: number;
  total_items: number;
  total_premium: number;
  total_points: number;
  is_vc_qualifying: boolean;
  vc_items: number;
  vc_premium: number;
  vc_points: number;
  is_bundle: boolean;
  bundle_type: string | null;
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

    // Create supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.error('[create_staff_sale] Session lookup failed:', sessionError);
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

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('[create_staff_sale] Staff user lookup failed:', staffError);
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

    const body: CreateSaleRequest = await req.json();
    console.log('[create_staff_sale] Creating sale for staff:', staffUser.id);

    // Get team member name for activity logging
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', staffUser.team_member_id)
      .single();
    const teamMemberName = teamMember?.name || 'Staff Member';

    // Validate required fields
    if (!body.customer_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Customer name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.lead_source_id) {
      return new Response(
        JSON.stringify({ error: 'Lead source is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.policies || body.policies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one policy is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse customer name into first/last
    const nameParts = body.customer_name.trim().split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

    // Find or create contact for this customer
    let contactId: string | null = null;
    try {
      const { data: contactResult } = await supabase.rpc('find_or_create_contact', {
        p_agency_id: staffUser.agency_id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_zip_code: body.customer_zip || null,
        p_phone: body.customer_phone || null,
        p_email: body.customer_email || null,
      });
      contactId = contactResult;
      console.log('[create_staff_sale] Contact linked:', contactId);
    } catch (contactErr) {
      console.warn('[create_staff_sale] Could not link contact:', contactErr);
      // Continue without contact - not a fatal error
    }

    // Create LQS pipeline records (household → quote → sale)
    let lqsHouseholdId: string | null = null;
    try {
      // Generate household key
      const { data: householdKey } = await supabase.rpc('generate_household_key', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_zip_code: body.customer_zip || '00000',
      });

      // Find or create lqs_households record
      const { data: existingHousehold } = await supabase
        .from('lqs_households')
        .select('id')
        .eq('agency_id', staffUser.agency_id)
        .eq('household_key', householdKey)
        .maybeSingle();

      if (existingHousehold) {
        lqsHouseholdId = existingHousehold.id;
        console.log('[create_staff_sale] Found existing LQS household:', lqsHouseholdId);
      } else {
        // Create new household (starts as 'lead')
        const { data: newHousehold, error: householdErr } = await supabase
          .from('lqs_households')
          .insert({
            agency_id: staffUser.agency_id,
            household_key: householdKey,
            first_name: firstName.toUpperCase(),
            last_name: lastName.toUpperCase(),
            zip_code: body.customer_zip || '00000',
            phone: body.customer_phone || null,
            email: body.customer_email || null,
            lead_source_id: body.lead_source_id,
            status: 'lead',
            lead_received_date: body.sale_date,
            team_member_id: staffUser.team_member_id,
            contact_id: contactId,
          })
          .select('id')
          .single();

        if (householdErr) {
          console.warn('[create_staff_sale] Failed to create LQS household:', householdErr);
        } else {
          lqsHouseholdId = newHousehold.id;
          console.log('[create_staff_sale] Created LQS household:', lqsHouseholdId);
        }
      }

      // Create quote and sale records for each policy (this auto-updates household status via triggers)
      if (lqsHouseholdId) {
        for (const policy of body.policies) {
          const premiumCents = Math.round((policy.items.reduce((sum, i) => sum + i.premium, 0)) * 100);
          const itemsCount = policy.items.reduce((sum, i) => sum + i.item_count, 0);

          // Create quote (triggers status → 'quoted')
          await supabase
            .from('lqs_quotes')
            .insert({
              household_id: lqsHouseholdId,
              agency_id: staffUser.agency_id,
              team_member_id: staffUser.team_member_id,
              quote_date: body.sale_date,
              product_type: policy.policy_type_name,
              items_quoted: itemsCount,
              premium_cents: premiumCents,
              issued_policy_number: policy.policy_number || null,
              source: 'manual',
            });

          // Create sale (triggers status → 'sold')
          await supabase
            .from('lqs_sales')
            .insert({
              household_id: lqsHouseholdId,
              agency_id: staffUser.agency_id,
              team_member_id: staffUser.team_member_id,
              sale_date: body.sale_date,
              product_type: policy.policy_type_name,
              items_sold: itemsCount,
              policies_sold: 1,
              premium_cents: premiumCents,
              policy_number: policy.policy_number || null,
              source: 'sales_dashboard',
            });
        }
        console.log('[create_staff_sale] LQS quotes and sales created');
      }
    } catch (lqsErr) {
      console.warn('[create_staff_sale] LQS pipeline creation failed:', lqsErr);
      // Continue - LQS tracking is non-critical
    }

    // Insert the main sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        agency_id: staffUser.agency_id,
        team_member_id: staffUser.team_member_id,
        contact_id: contactId,
        lead_source_id: body.lead_source_id,
        customer_name: body.customer_name,
        customer_email: body.customer_email || null,
        customer_phone: body.customer_phone || null,
        customer_zip: body.customer_zip || null,
        sale_date: body.sale_date,
        effective_date: body.effective_date,
        total_policies: body.total_policies,
        total_items: body.total_items,
        total_premium: body.total_premium,
        total_points: body.total_points,
        is_vc_qualifying: body.is_vc_qualifying,
        vc_items: body.vc_items,
        vc_premium: body.vc_premium,
        vc_points: body.vc_points,
        is_bundle: body.is_bundle,
        bundle_type: body.bundle_type,
        source: body.source,
        source_details: body.source_details || null,
      })
      .select('id')
      .single();

    if (saleError) {
      console.error('[create_staff_sale] Failed to create sale:', saleError);
      throw saleError;
    }

    console.log('[create_staff_sale] Sale created:', sale.id);

    // Insert policies and items
    for (const policy of body.policies) {
      // Calculate policy totals
      const policyTotals = policy.items.reduce(
        (acc, item) => ({
          items: acc.items + item.item_count,
          premium: acc.premium + item.premium,
          points: acc.points + item.points,
        }),
        { items: 0, premium: 0, points: 0 }
      );

      const { data: createdPolicy, error: policyError } = await supabase
        .from('sale_policies')
        .insert({
          sale_id: sale.id,
          product_type_id: policy.product_type_id || null,
          policy_type_name: policy.policy_type_name,
          policy_number: policy.policy_number || null,
          effective_date: policy.effective_date,
          total_items: policyTotals.items,
          total_premium: policyTotals.premium,
          total_points: policyTotals.points,
          is_vc_qualifying: policy.is_vc_qualifying,
        })
        .select('id')
        .single();

      if (policyError) {
        console.error('[create_staff_sale] Failed to create policy:', policyError);
        throw policyError;
      }

      // Insert line items
      const saleItems = policy.items.map((item) => ({
        sale_id: sale.id,
        sale_policy_id: createdPolicy.id,
        product_type_id: item.product_type_id || null,
        product_type_name: item.product_type_name,
        item_count: item.item_count,
        premium: item.premium,
        points: item.points,
        is_vc_qualifying: item.is_vc_qualifying,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) {
        console.error('[create_staff_sale] Failed to create items:', itemsError);
        throw itemsError;
      }
    }

    console.log('[create_staff_sale] Sale creation complete');

    // Log activity to contact_activities for unified tracking
    if (contactId) {
      try {
        await supabase.rpc('insert_contact_activity', {
          p_agency_id: staffUser.agency_id,
          p_contact_id: contactId,
          p_source_module: 'lqs',
          p_activity_type: 'policy_sold',
          p_source_record_id: sale.id,
          p_notes: `Sale: ${body.total_policies} ${body.total_policies === 1 ? 'policy' : 'policies'}, $${body.total_premium.toLocaleString()} premium`,
          p_created_by_display_name: teamMemberName,
        });
        console.log('[create_staff_sale] Activity logged to contact_activities');
      } catch (activityErr) {
        console.warn('[create_staff_sale] Failed to log activity:', activityErr);
        // Don't fail the sale for activity logging errors
      }
    }

    // Trigger real-time sale notification (non-blocking)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      fetch(`${supabaseUrl}/functions/v1/send-sale-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sale_id: sale.id,
          agency_id: staffUser.agency_id,
        }),
      }).catch(emailError => {
        // Log but don't fail the sale
        console.error('[create_staff_sale] Email notification failed:', emailError);
      });
    } catch (emailError) {
      // Log but don't fail the sale
      console.error('[create_staff_sale] Email notification setup failed:', emailError);
    }

    return new Response(
      JSON.stringify({ success: true, sale_id: sale.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create_staff_sale] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create sale' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
