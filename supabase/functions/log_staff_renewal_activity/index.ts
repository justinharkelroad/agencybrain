import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // If push_to_winback, create a winback record
    if (activityStatus === 'push_to_winback') {
      // Fetch the full renewal record to create winback
      const { data: renewalForWinback, error: renewalFetchError } = await supabase
        .from('renewal_records')
        .select(`
          id, agency_id, first_name, last_name, email, phone,
          policy_number, product_name, renewal_effective_date,
          premium_old, premium_new, agent_number, household_key, contact_id
        `)
        .eq('id', renewalRecordId)
        .single();

      if (renewalFetchError) {
        console.error('[log_staff_renewal_activity] Failed to fetch renewal for winback:', renewalFetchError);
      } else if (renewalForWinback && renewalForWinback.first_name && renewalForWinback.last_name) {
        // Create or find existing winback household
        const firstName = renewalForWinback.first_name.trim().toUpperCase();
        const lastName = renewalForWinback.last_name.trim().toUpperCase();
        let zipCode = '00000';
        if (renewalForWinback.household_key) {
          const zipMatch = renewalForWinback.household_key.match(/\d{5}/);
          if (zipMatch) zipCode = zipMatch[0];
        }

        // Check for existing household
        const { data: existingHousehold } = await supabase
          .from('winback_households')
          .select('id')
          .eq('agency_id', agencyId)
          .ilike('first_name', firstName)
          .ilike('last_name', lastName)
          .maybeSingle();

        let householdId: string;

        if (existingHousehold) {
          householdId = existingHousehold.id;
        } else {
          const { data: newHousehold, error: householdError } = await supabase
            .from('winback_households')
            .insert({
              agency_id: agencyId,
              first_name: firstName,
              last_name: lastName,
              zip_code: zipCode,
              email: renewalForWinback.email || null,
              phone: renewalForWinback.phone || null,
              status: 'untouched',
              contact_id: renewalForWinback.contact_id || contactId || null,
            })
            .select('id')
            .single();

          if (householdError) {
            console.error('[log_staff_renewal_activity] Failed to create winback household:', householdError);
          } else {
            householdId = newHousehold.id;
          }
        }

        // If household exists or was created, create the policy
        if (householdId!) {
          // Update contact_id on existing household if not set
          if (existingHousehold && (renewalForWinback.contact_id || contactId)) {
            await supabase
              .from('winback_households')
              .update({ contact_id: renewalForWinback.contact_id || contactId })
              .eq('id', householdId)
              .is('contact_id', null);
          }

          // Check for existing policy
          const { data: existingPolicy } = await supabase
            .from('winback_policies')
            .select('id')
            .eq('agency_id', agencyId)
            .eq('policy_number', renewalForWinback.policy_number)
            .maybeSingle();

          if (!existingPolicy) {
            // Calculate winback date
            const terminationDate = new Date(renewalForWinback.renewal_effective_date);
            const policyTermMonths = 12; // Default to annual
            const contactDaysBefore = 45;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let competitorRenewal = new Date(terminationDate);
            competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);

            let winbackDate = new Date(competitorRenewal);
            winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);

            while (winbackDate <= today) {
              competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);
              winbackDate = new Date(competitorRenewal);
              winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
            }

            const premiumNewCents = renewalForWinback.premium_new ? Math.round(renewalForWinback.premium_new * 100) : null;
            const premiumOldCents = renewalForWinback.premium_old ? Math.round(renewalForWinback.premium_old * 100) : null;
            const premiumChangeCents = premiumNewCents && premiumOldCents ? premiumNewCents - premiumOldCents : null;
            const premiumChangePercent = premiumOldCents && premiumChangeCents
              ? Math.round((premiumChangeCents / premiumOldCents) * 10000) / 100
              : null;

            const { error: policyError } = await supabase
              .from('winback_policies')
              .insert({
                household_id: householdId,
                agency_id: agencyId,
                policy_number: renewalForWinback.policy_number,
                agent_number: renewalForWinback.agent_number || null,
                product_name: renewalForWinback.product_name || 'Unknown',
                policy_term_months: policyTermMonths,
                termination_effective_date: renewalForWinback.renewal_effective_date,
                termination_reason: 'Renewal Not Taken - From Renewal Audit',
                premium_new_cents: premiumNewCents,
                premium_old_cents: premiumOldCents,
                premium_change_cents: premiumChangeCents,
                premium_change_percent: premiumChangePercent,
                calculated_winback_date: winbackDate.toISOString().split('T')[0],
                is_cancel_rewrite: false,
              });

            if (policyError) {
              console.error('[log_staff_renewal_activity] Failed to create winback policy:', policyError);
            } else {
              // Recalculate aggregates
              await supabase.rpc('recalculate_winback_household_aggregates', {
                p_household_id: householdId,
              }).catch(e => console.error('Failed to recalc aggregates:', e));
            }
          }

          // Update renewal record with winback link
          await supabase
            .from('renewal_records')
            .update({
              winback_household_id: householdId,
              sent_to_winback_at: new Date().toISOString(),
            })
            .eq('id', renewalRecordId);

          console.log('[log_staff_renewal_activity] Created/linked winback household:', householdId);
        }
      }
    }

    // Mirror to contact_activities for "Last Activity" display
    // First get contact_id from the renewal record if not passed
    let mirrorContactId = contactId;
    if (!mirrorContactId) {
      const { data: renewalRecord } = await supabase
        .from('renewal_records')
        .select('contact_id')
        .eq('id', renewalRecordId)
        .single();
      mirrorContactId = renewalRecord?.contact_id;
    }

    if (mirrorContactId) {
      try {
        await supabase.rpc('insert_contact_activity', {
          p_contact_id: mirrorContactId,
          p_agency_id: agencyId,
          p_source_module: 'renewal',
          p_activity_type: activityType,
          p_activity_subtype: activityStatus || null,
          p_source_record_id: renewalRecordId,
          p_notes: `Renewal: ${activityType}${activityStatus ? ` - ${activityStatus}` : ''}`,
          p_created_by_display_name: displayName,
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
