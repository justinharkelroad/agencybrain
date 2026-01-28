import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

// Helper function to send renewal to Winback
async function sendToWinback(supabase: any, record: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (!record.first_name || !record.last_name) return { success: false, error: 'Missing name' };
    if (!record.renewal_effective_date) return { success: false, error: 'Missing date' };
    if (!record.policy_number) return { success: false, error: 'Missing policy' };

    const terminationDate = new Date(record.renewal_effective_date);
    const policyTermMonths = record.product_name?.toUpperCase().includes('AUTO') ? 6 : 12;
    const contactDaysBefore = 45;
    
    // Calculate winback date
    let competitorRenewal = new Date(terminationDate);
    competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);
    let winbackDate = new Date(competitorRenewal);
    winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
    const today = new Date();
    while (winbackDate <= today) {
      competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);
      winbackDate = new Date(competitorRenewal);
      winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
    }

    const zipCode = record.household_key?.match(/\d{5}/)?.[0] || '00000';

    // Check/create household
    const { data: existingHousehold } = await supabase
      .from('winback_households')
      .select('id')
      .eq('agency_id', record.agency_id)
      .ilike('first_name', record.first_name.trim())
      .ilike('last_name', record.last_name.trim())
      .maybeSingle();

    let householdId: string;
    if (existingHousehold) {
      householdId = existingHousehold.id;
    } else {
      const { data: newHousehold, error } = await supabase
        .from('winback_households')
        .insert({
          agency_id: record.agency_id,
          first_name: record.first_name.trim().toUpperCase(),
          last_name: record.last_name.trim().toUpperCase(),
          zip_code: zipCode,
          email: record.email || null,
          phone: record.phone || null,
          status: 'untouched',
        })
        .select('id')
        .single();
      if (error) return { success: false, error: error instanceof Error ? error.message : 'Insert failed' };
      householdId = newHousehold.id;
    }

    // Check for existing policy
    const { data: existingPolicy } = await supabase
      .from('winback_policies')
      .select('id')
      .eq('agency_id', record.agency_id)
      .eq('policy_number', record.policy_number)
      .maybeSingle();

    if (!existingPolicy) {
      const premiumNewCents = record.premium_new ? Math.round(record.premium_new * 100) : null;
      const premiumOldCents = record.premium_old ? Math.round(record.premium_old * 100) : null;
      
      await supabase.from('winback_policies').insert({
        household_id: householdId,
        agency_id: record.agency_id,
        policy_number: record.policy_number,
        agent_number: record.agent_number || null,
        product_name: record.product_name || 'Unknown',
        policy_term_months: policyTermMonths,
        termination_effective_date: record.renewal_effective_date,
        termination_reason: 'Renewal Not Taken - From Renewal Audit',
        premium_new_cents: premiumNewCents,
        premium_old_cents: premiumOldCents,
        calculated_winback_date: winbackDate.toISOString().split('T')[0],
        is_cancel_rewrite: false,
      });

      await supabase.rpc('recalculate_winback_household_aggregates', { p_household_id: householdId });
    }

    // Update renewal record (link it to the created household)
    const { error: linkError } = await supabase
      .from('renewal_records')
      .update({
        winback_household_id: householdId,
        sent_to_winback_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .eq('agency_id', record.agency_id);

    if (linkError) {
      console.error('[get_staff_renewals] Failed to link renewal to winback household:', linkError);
      return { success: false, error: linkError.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      console.error('[get_staff_renewals] Missing session token');
      return new Response(JSON.stringify({ error: 'Missing session token' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, staff_users(id, agency_id, is_active)')
      .eq('session_token', sessionToken)
      .single() as { data: any; error: any };

    if (sessionError) {
      console.error('[get_staff_renewals] Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Note: staff_users is returned as an object (not array) when using .single()
    if (!session || new Date(session.expires_at) < new Date() || !session.staff_users?.is_active) {
      console.error('[get_staff_renewals] Session expired or user inactive');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = session.staff_users.agency_id;
    console.log('[get_staff_renewals] Valid session for agency:', agencyId);

    const body = await req.json().catch(() => ({}));
    const { operation, filters = {}, params = {}, page = 1, pageSize = 50 } = body;

    // Handle chart_data operation - lightweight query for chart display
    if (operation === 'chart_data') {
      const { startDate, endDate } = params;
      console.log('[get_staff_renewals] Fetching chart data for dates:', startDate, 'to', endDate);
      
      const { data, error } = await supabase
        .from('renewal_records')
        .select('renewal_effective_date')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .gte('renewal_effective_date', startDate)
        .lte('renewal_effective_date', endDate);
      
      if (error) {
        console.error('[get_staff_renewals] Chart data query error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('[get_staff_renewals] Chart data returned', data?.length, 'records');
      return new Response(JSON.stringify({ records: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle update_record operation
    if (operation === 'update_record') {
      const { id, updates, displayName, userId, sendToWinback: shouldSendToWinback } = params;
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing record id' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data, error } = await supabase
        .from('renewal_records')
        .update({
          ...updates,
          last_activity_at: new Date().toISOString(),
          last_activity_by: userId,
          last_activity_by_display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('agency_id', agencyId)
        .select('*, assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey(id, name)')
        .single();

      if (error) {
        console.error('[get_staff_renewals] Update error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Operation failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If sendToWinback flag is set and status is unsuccessful, create winback records
      let winbackResult = null;
      if (shouldSendToWinback && updates.current_status === 'unsuccessful') {
        console.log('[get_staff_renewals] Sending record to Winback:', id);
        
        // Fetch full record details for winback
        const { data: fullRecord } = await supabase
          .from('renewal_records')
          .select('id, agency_id, first_name, last_name, email, phone, policy_number, product_name, renewal_effective_date, premium_old, premium_new, agent_number, household_key')
          .eq('id', id)
          .single();
        
        if (fullRecord) {
          winbackResult = await sendToWinback(supabase, fullRecord);
          console.log('[get_staff_renewals] Winback result:', winbackResult);
        }
      }

      console.log('[get_staff_renewals] Updated record:', id);
      return new Response(JSON.stringify({ record: data, winbackResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle bulk_update_records operation
    if (operation === 'bulk_update_records') {
      const { ids, updates, displayName, userId, sendToWinback } = params;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: 'ids array is required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[get_staff_renewals] Bulk updating ${ids.length} records, sendToWinback: ${sendToWinback}`);

      // Verify all records belong to this agency
      const { data: verifyRecords, error: verifyError } = await supabase
        .from('renewal_records')
        .select('id')
        .eq('agency_id', agencyId)
        .in('id', ids);

      if (verifyError) {
        console.error('[get_staff_renewals] Bulk update verification error:', verifyError);
        return new Response(JSON.stringify({ error: verifyError.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (verifyRecords.length !== ids.length) {
        return new Response(JSON.stringify({ error: 'Some records do not belong to this agency' }), { 
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data, error } = await supabase
        .from('renewal_records')
        .update({
          ...updates,
          last_activity_at: new Date().toISOString(),
          last_activity_by: userId,
          last_activity_by_display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq('agency_id', agencyId)
        .in('id', ids)
        .select();

      if (error) {
        console.error('[get_staff_renewals] Bulk update error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Operation failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If updating to unsuccessful, also send to Winback
      let winbackCount = 0;
      if (sendToWinback && updates.current_status === 'unsuccessful') {
        console.log('[get_staff_renewals] Sending records to Winback...');
        
        // Fetch full record details
        const { data: fullRecords } = await supabase
          .from('renewal_records')
          .select('id, agency_id, first_name, last_name, email, phone, policy_number, product_name, renewal_effective_date, premium_old, premium_new, agent_number, household_key')
          .in('id', ids);
        
        if (fullRecords) {
          for (const record of fullRecords) {
            try {
              const result = await sendToWinback(supabase, record);
              if (result.success) {
                winbackCount++;
              } else {
                console.warn(`[get_staff_renewals] Failed to send ${record.policy_number} to winback:`, result.error);
              }
            } catch (err) {
              console.error(`[get_staff_renewals] Error sending ${record.policy_number} to winback:`, err);
            }
          }
        }
      }

      console.log(`[get_staff_renewals] Bulk updated ${data.length} records, ${winbackCount} sent to Winback`);
      return new Response(JSON.stringify({ count: data.length, winbackCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle bulk_delete_records operation
    if (operation === 'bulk_delete_records') {
      const { ids } = params;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: 'ids array is required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[get_staff_renewals] Bulk deleting ${ids.length} records`);

      // Verify all records belong to this agency
      const { data: verifyRecords, error: verifyError } = await supabase
        .from('renewal_records')
        .select('id')
        .eq('agency_id', agencyId)
        .in('id', ids);

      if (verifyError) {
        console.error('[get_staff_renewals] Bulk delete verification error:', verifyError);
        return new Response(JSON.stringify({ error: verifyError.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (verifyRecords.length !== ids.length) {
        return new Response(JSON.stringify({ error: 'Some records do not belong to this agency' }), { 
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // First delete associated activities
      const { error: activitiesError } = await supabase
        .from('renewal_activities')
        .delete()
        .in('renewal_record_id', ids);

      if (activitiesError) {
        console.error('[get_staff_renewals] Bulk delete activities error:', activitiesError);
        return new Response(JSON.stringify({ error: activitiesError.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Then delete the records
      const { error: recordsError } = await supabase
        .from('renewal_records')
        .delete()
        .eq('agency_id', agencyId)
        .in('id', ids);

      if (recordsError) {
        console.error('[get_staff_renewals] Bulk delete records error:', recordsError);
        return new Response(JSON.stringify({ error: recordsError.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[get_staff_renewals] Bulk deleted ${ids.length} records`);
      return new Response(JSON.stringify({ count: ids.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate pagination offsets
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query for fetching records with count
    let query = supabase
      .from('renewal_records')
      .select('*, assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey(id, name)', { count: 'exact' })
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('renewal_effective_date', { ascending: true })
      .order('id', { ascending: true });

    // Apply filters
    if (filters.currentStatus?.length) {
      query = query.in('current_status', filters.currentStatus);
    }
    if (filters.renewalStatus?.length) {
      query = query.in('renewal_status', filters.renewalStatus);
    }
    if (filters.productName?.length) {
      query = query.in('product_name', filters.productName);
    }
    if (filters.bundledStatus === 'bundled') {
      query = query.eq('multi_line_indicator', true);
    } else if (filters.bundledStatus === 'monoline') {
      query = query.eq('multi_line_indicator', false);
    }
    if (filters.accountType?.length) {
      query = query.in('account_type', filters.accountType);
    }
    if (filters.assignedTeamMemberId) {
      if (filters.assignedTeamMemberId === 'unassigned') {
        query = query.is('assigned_team_member_id', null);
      } else {
        query = query.eq('assigned_team_member_id', filters.assignedTeamMemberId);
      }
    }
    if (filters.dateRange?.start) {
      query = query.gte('renewal_effective_date', filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query = query.lte('renewal_effective_date', filters.dateRange.end);
    }
    if (filters.searchQuery) {
      query = query.or(`first_name.ilike.%${filters.searchQuery}%,last_name.ilike.%${filters.searchQuery}%,policy_number.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%,phone.ilike.%${filters.searchQuery}%`);
    }

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;
    
    if (error) {
      console.error('[get_staff_renewals] Query error:', error);
      return new Response(JSON.stringify({ error: error?.message || 'Query failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[get_staff_renewals] Returning', data?.length || 0, 'of', count, 'records (page', page, ')');
    return new Response(JSON.stringify({ records: data || [], totalCount: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get_staff_renewals] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
