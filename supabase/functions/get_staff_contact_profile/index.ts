import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Missing session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('*, staff_users!inner(id, agency_id, is_active, display_name)')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error('[get_staff_contact_profile] Session lookup failed:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!session.staff_users?.is_active) {
      return new Response(JSON.stringify({ error: 'User is not active' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const staffAgencyId = session.staff_users.agency_id;
    console.log('[get_staff_contact_profile] Valid session for agency:', staffAgencyId);

    // Parse request body
    const { contactId, agencyId, cancelAuditHouseholdKey, winbackHouseholdId, renewalRecordId } = await req.json();

    if (!contactId || !agencyId) {
      return new Response(JSON.stringify({ error: 'Missing contactId or agencyId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify agency access
    if (agencyId !== staffAgencyId) {
      console.error('[get_staff_contact_profile] Agency mismatch');
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the contact (using service role - bypasses RLS)
    const { data: contact, error: contactError } = await supabase
      .from('agency_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('agency_id', agencyId)
      .single();

    if (contactError) {
      if (contactError.code === 'PGRST116') {
        return new Response(JSON.stringify({ profile: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('[get_staff_contact_profile] Contact fetch failed:', contactError);
      return new Response(JSON.stringify({ error: contactError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const householdKey = contact.household_key;

    // Fetch linked records in parallel
    const [activitiesResult, lqsResult, renewalResult, cancelAuditResult, winbackResult] = await Promise.all([
      // Unified activities from contact_activities
      supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
        .order('activity_date', { ascending: false })
        .limit(100),

      // LQS records with nested quotes, sales, and lead source
      supabase
        .from('lqs_households')
        .select(`
          id,
          status,
          created_at,
          team_member_id,
          team_members:team_member_id (id, name),
          lead_source:lead_sources (name),
          quotes:lqs_quotes (id, quote_date, product_type, items_quoted, premium_cents, issued_policy_number),
          sales:lqs_sales (id, sale_date, product_type, items_sold, policies_sold, premium_cents, policy_number)
        `)
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false }),

      // Renewal records
      supabase
        .from('renewal_records')
        .select(`
          id,
          policy_number,
          renewal_effective_date,
          renewal_status,
          current_status,
          premium_new,
          premium_old,
          premium_change_percent,
          product_name,
          amount_due,
          easy_pay,
          multi_line_indicator,
          assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey (id, name)
        `)
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('renewal_effective_date', { ascending: false }),

      // Cancel audit records - use household_key if provided, otherwise contact_id
      cancelAuditHouseholdKey
        ? supabase
            .from('cancel_audit_records')
            .select(`
              id,
              household_key,
              cancel_status,
              status,
              created_at,
              assigned_team_member_id,
              policy_number,
              product_name,
              premium_cents,
              amount_due_cents,
              cancel_date,
              pending_cancel_date,
              report_type,
              insured_first_name,
              insured_last_name,
              insured_phone,
              insured_email,
              assigned_team_member:team_members!cancel_audit_records_assigned_team_member_id_fkey (id, name)
            `)
            .eq('household_key', cancelAuditHouseholdKey)
            .eq('agency_id', agencyId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        : supabase
            .from('cancel_audit_records')
            .select(`
              id,
              household_key,
              cancel_status,
              status,
              created_at,
              assigned_team_member_id,
              policy_number,
              product_name,
              premium_cents,
              amount_due_cents,
              cancel_date,
              pending_cancel_date,
              report_type,
              insured_first_name,
              insured_last_name,
              insured_phone,
              insured_email,
              assigned_team_member:team_members!cancel_audit_records_assigned_team_member_id_fkey (id, name)
            `)
            .eq('contact_id', contactId)
            .eq('agency_id', agencyId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),

      // Winback records - use ID if provided, otherwise contact_id
      winbackHouseholdId
        ? supabase
            .from('winback_households')
            .select(`
              id,
              first_name,
              last_name,
              status,
              next_contact_date,
              created_at,
              policies:winback_policies (
                id,
                policy_number,
                product_name,
                termination_effective_date,
                termination_reason,
                calculated_winback_date,
                premium_new_cents,
                premium_old_cents,
                premium_change_percent
              )
            `)
            .eq('id', winbackHouseholdId)
            .eq('agency_id', agencyId)
        : supabase
            .from('winback_households')
            .select(`
              id,
              first_name,
              last_name,
              status,
              next_contact_date,
              created_at,
              policies:winback_policies (
                id,
                policy_number,
                product_name,
                termination_effective_date,
                termination_reason,
                calculated_winback_date,
                premium_new_cents,
                premium_old_cents,
                premium_change_percent
              )
            `)
            .eq('contact_id', contactId)
            .eq('agency_id', agencyId),
    ]);

    // Build the profile response
    const activities = activitiesResult.data || [];
    const lqsRecords = lqsResult.data || [];
    const renewalRecords = renewalResult.data || [];
    const cancelAuditRecords = cancelAuditResult.data || [];
    const winbackRecords = winbackResult.data || [];

    // Fetch winback activities if we have winback records OR if winbackHouseholdId was provided
    const winbackHouseholdIds = winbackHouseholdId
      ? [winbackHouseholdId]
      : winbackRecords.map((r: any) => r.id);

    let allActivities = [...activities];

    if (winbackHouseholdIds.length > 0) {
      const { data: wbActivities } = await supabase
        .from('winback_activities')
        .select('id, activity_type, notes, created_by_name, created_at, household_id, old_status, new_status')
        .eq('agency_id', agencyId)
        .in('household_id', winbackHouseholdIds)
        .order('created_at', { ascending: false })
        .limit(50);

      // Map winback activities to unified format and merge
      const mappedWinbackActivities = (wbActivities || []).map((wa: any) => ({
        id: wa.id,
        contact_id: contactId,
        agency_id: agencyId,
        source_module: 'winback',
        activity_type: mapWinbackActivityType(wa.activity_type),
        notes: wa.notes,
        created_by_display_name: wa.created_by_name,
        activity_date: wa.created_at,
        created_at: wa.created_at,
        old_status: wa.old_status,
        new_status: wa.new_status,
      }));

      allActivities = [...activities, ...mappedWinbackActivities]
        .sort((a, b) => new Date(b.activity_date || b.created_at).getTime() - new Date(a.activity_date || a.created_at).getTime());
    }

    // Calculate lifecycle stage based on linked records
    // Priority order matches get_contacts_by_stage RPC for consistency
    let lifecycleStage = 'open_lead';  // Default to valid stage

    // 1. Winback (highest priority) - only ACTIVE winback records (NOT moved_to_quoted)
    if (winbackRecords.length > 0 && winbackRecords.some((r: any) =>
        r.status === 'untouched' || r.status === 'in_progress'
    )) {
      lifecycleStage = 'winback';
    }
    // 2. Cancel Audit - active records not saved
    else if (cancelAuditRecords.length > 0 && cancelAuditRecords.some((r: any) =>
        r.cancel_status !== 'Saved' && r.cancel_status !== 'saved'
    )) {
      lifecycleStage = 'cancel_audit';
    }
    // 3. Customer - has sales, successful renewals, or saved cancel audits
    else if (
      lqsRecords.some((r: any) => r.sales && r.sales.length > 0) ||
      renewalRecords.some((r: any) => r.current_status === 'success') ||
      cancelAuditRecords.some((r: any) => r.cancel_status === 'Saved' || r.cancel_status === 'saved')
    ) {
      lifecycleStage = 'customer';
    }
    // 4. Renewal - active renewal records
    else if (renewalRecords.length > 0 && renewalRecords.some((r: any) =>
        r.current_status === 'uncontacted' || r.current_status === 'pending'
    )) {
      lifecycleStage = 'renewal';
    }
    // 5. Quoted - has quotes OR lqs_households with status='quoted' OR winback moved_to_quoted
    else if (
      lqsRecords.some((r: any) => r.quotes && r.quotes.length > 0) ||
      lqsRecords.some((r: any) => r.status === 'quoted') ||
      winbackRecords.some((r: any) => r.status === 'moved_to_quoted')
    ) {
      lifecycleStage = 'quoted';
    }
    // 6. Default: open_lead (already set)

    // Build journey events from all activities and records
    const journeyEvents: any[] = [];

    // Add activities to journey
    for (const activity of allActivities) {
      journeyEvents.push({
        id: activity.id,
        date: activity.activity_date,
        type: activity.activity_type,
        subtype: activity.activity_subtype,
        source: activity.source_module,
        description: activity.notes || activity.subject || `${activity.activity_type} activity`,
        outcome: activity.outcome,
        createdByName: activity.created_by_display_name,
      });
    }

    // Add LQS events
    for (const lqs of lqsRecords) {
      if (lqs.quotes) {
        for (const quote of lqs.quotes) {
          journeyEvents.push({
            id: `quote-${quote.id}`,
            date: quote.quote_date,
            type: 'quote',
            source: 'lqs',
            description: `Quoted ${quote.product_type} - ${quote.items_quoted} items`,
          });
        }
      }
      if (lqs.sales) {
        for (const sale of lqs.sales) {
          journeyEvents.push({
            id: `sale-${sale.id}`,
            date: sale.sale_date,
            type: 'sale',
            source: 'lqs',
            description: `Sold ${sale.product_type} - ${sale.items_sold} items`,
          });
        }
      }
    }

    // Sort journey by date descending
    journeyEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const profile = {
      contact,
      activities: allActivities,
      lqsRecords,
      renewalRecords,
      cancelAuditRecords,
      winbackRecords,
      lifecycleStage,
      journeyEvents: journeyEvents.slice(0, 50), // Limit to 50 events
    };

    console.log('[get_staff_contact_profile] Successfully fetched profile for contact:', contactId);
    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[get_staff_contact_profile] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Map winback activity types to unified activity types
function mapWinbackActivityType(type: string): string {
  const mapping: Record<string, string> = {
    'called': 'call',
    'left_vm': 'voicemail',
    'texted': 'text',
    'emailed': 'email',
    'note': 'note',
    'status_change': 'status_change',
    'quoted': 'quoted',
    'won_back': 'won_back',
  };
  return mapping[type] || type;
}
