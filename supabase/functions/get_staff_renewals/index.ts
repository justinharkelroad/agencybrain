import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      .single();

    if (sessionError) {
      console.error('[get_staff_renewals] Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!session || new Date(session.expires_at) < new Date() || !session.staff_users?.is_active) {
      console.error('[get_staff_renewals] Session expired or user inactive');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const agencyId = session.staff_users.agency_id;
    console.log('[get_staff_renewals] Valid session for agency:', agencyId);

    const body = await req.json().catch(() => ({}));
    const { operation, filters = {}, params = {} } = body;

    // Handle update_record operation
    if (operation === 'update_record') {
      const { id, updates, displayName, userId } = params;
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
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('[get_staff_renewals] Updated record:', id);
      return new Response(JSON.stringify({ record: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle bulk_update_records operation
    if (operation === 'bulk_update_records') {
      const { ids, updates, displayName, userId } = params;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: 'ids array is required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[get_staff_renewals] Bulk updating ${ids.length} records`);

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
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[get_staff_renewals] Bulk updated ${data.length} records`);
      return new Response(JSON.stringify({ count: data.length }), {
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

    // Build query for fetching records
    let query = supabase
      .from('renewal_records')
      .select('*, assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey(id, name)')
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

    const { data, error } = await query;
    
    if (error) {
      console.error('[get_staff_renewals] Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[get_staff_renewals] Returning', data?.length || 0, 'records');
    return new Response(JSON.stringify({ records: data || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get_staff_renewals] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
