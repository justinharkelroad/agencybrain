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
      console.error('[log_staff_renewal_activity] Missing session token');
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
      .select('staff_user_id, expires_at, staff_users(id, agency_id, is_active, display_name, team_member_id)')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError) {
      console.error('[log_staff_renewal_activity] Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Cast staff_users to object (Supabase returns object for many-to-one FK joins with .single())
    const staffUser = session?.staff_users as unknown as { id: string; agency_id: string; is_active: boolean; display_name: string; team_member_id: string | null } | null;

    if (!session || new Date(session.expires_at) < new Date() || !staffUser?.is_active) {
      console.error('[log_staff_renewal_activity] Session expired or user inactive');
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = staffUser.agency_id;
    console.log('[log_staff_renewal_activity] Valid session for agency:', agencyId);

    const body = await req.json();
    const {
      renewalRecordId,
      activityType,
      activityStatus,
      subject,
      comments,
      scheduledDate,
      sendCalendarInvite,
      assignedTeamMemberId,
      updateRecordStatus,
      // New params for staff-specific handling
      markAsSuccessful,
      winbackHouseholdId,
      contactId,
    } = body;

    if (!renewalRecordId || !activityType) {
      return new Response(JSON.stringify({ error: 'renewalRecordId and activityType are required' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify the renewal record belongs to this agency
    const { data: record, error: recordError } = await supabase
      .from('renewal_records')
      .select('id, agency_id')
      .eq('id', renewalRecordId)
      .single();

    if (recordError || !record || record.agency_id !== agencyId) {
      console.error('[log_staff_renewal_activity] Record not found or wrong agency');
      return new Response(JSON.stringify({ error: 'Record not found' }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const displayName = staffUser.display_name || 'Staff User';

    // Create the activity
    const { error: activityError } = await supabase
      .from('renewal_activities')
      .insert({
        renewal_record_id: renewalRecordId,
        agency_id: agencyId,
        activity_type: activityType,
        activity_status: activityStatus || null,
        subject: subject || null,
        comments: comments || null,
        scheduled_date: scheduledDate || null,
        send_calendar_invite: sendCalendarInvite || false,
        assigned_team_member_id: assignedTeamMemberId || staffUser.team_member_id || null,
        created_by: null, // Staff users don't have auth.uid()
        created_by_display_name: displayName,
      });

    if (activityError) {
      console.error('[log_staff_renewal_activity] Activity insert error:', activityError);
      return new Response(JSON.stringify({ error: activityError.message }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update parent record
    const recordUpdates: Record<string, any> = {
      last_activity_at: new Date().toISOString(),
      last_activity_by: null,
      last_activity_by_display_name: displayName,
      updated_at: new Date().toISOString(),
    };

    if (updateRecordStatus) {
      recordUpdates.current_status = updateRecordStatus;
    }

    // If marked as successful, also update renewal_status
    if (markAsSuccessful) {
      recordUpdates.renewal_status = 'Renewal Taken';
    }

    const { error: updateError } = await supabase
      .from('renewal_records')
      .update(recordUpdates)
      .eq('id', renewalRecordId);

    if (updateError) {
      console.error('[log_staff_renewal_activity] Record update error:', updateError);
      // Don't fail the whole operation for update error
    }

    // If marked as successful, close out any associated winback record
    if (markAsSuccessful) {
      if (winbackHouseholdId) {
        // Direct link exists - update that winback
        const { error: winbackError } = await supabase
          .from('winback_households')
          .update({ status: 'won_back', updated_at: new Date().toISOString() })
          .eq('id', winbackHouseholdId)
          .eq('agency_id', agencyId);

        if (winbackError) {
          console.error('[log_staff_renewal_activity] Winback update error:', winbackError);
        }
      } else if (contactId) {
        // No direct link - find winback by contact_id and close it
        const { error: winbackError } = await supabase
          .from('winback_households')
          .update({ status: 'won_back', updated_at: new Date().toISOString() })
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .in('status', ['untouched', 'in_progress']);

        if (winbackError) {
          console.error('[log_staff_renewal_activity] Winback update by contact error:', winbackError);
        }
      }
    }

    // Mirror to contact_activities for "Last Activity" display
    if (contactId) {
      try {
        await supabase.rpc('insert_contact_activity', {
          p_contact_id: contactId,
          p_agency_id: agencyId,
          p_activity_type: activityType,
          p_activity_subtype: activityStatus || null,
          p_description: `Renewal: ${activityType}${activityStatus ? ` - ${activityStatus}` : ''}`,
          p_created_by_name: displayName,
        });
      } catch (mirrorError) {
        console.error('[log_staff_renewal_activity] contact_activities mirror error:', mirrorError);
        // Don't fail - this is for display only
      }
    }

    console.log('[log_staff_renewal_activity] Activity logged successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[log_staff_renewal_activity] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
