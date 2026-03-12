import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Returns YYYY-MM-DD in the given IANA timezone. */
function localDateStr(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateAdhocTaskRequest {
  contact_id: string;
  due_date: string; // YYYY-MM-DD format
  action_type: 'call' | 'text' | 'email' | 'other';
  title: string;
  description?: string | null;
  parent_task_id?: string | null;
  source_module?: string | null; // e.g. 'cancel_audit', 'renewal', 'winback'
  module_record_id?: string | null; // e.g. cancel_audit_records.id, renewal_records.id, winback_households.id
}

interface AuthResult {
  agencyId: string;
  staffUserId: string | null;
  userId: string | null;
  displayName: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate via staff session OR JWT.
    // CRITICAL: When x-staff-session header is present, this is a staff portal
    // request. If the staff session is invalid, return 401 immediately — NEVER
    // fall back to JWT. supabase.functions.invoke auto-sends Authorization:
    // Bearer <jwt> (could be a real user JWT if the agency owner also logged in
    // on the same browser). Falling back to JWT would silently create the task
    // under the owner's profile instead of the staff user, making it invisible
    // in the staff queue. (Production bug 2026-03-11)
    const sessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('authorization');

    let authResult: AuthResult | null = null;

    if (sessionToken) {
      // Staff portal request — authenticate via staff session ONLY
      const nowISO = new Date().toISOString();
      const { data: session, error: sessionError } = await supabase
        .from('staff_sessions')
        .select('staff_user_id, expires_at, is_valid')
        .eq('session_token', sessionToken)
        .eq('is_valid', true)
        .gt('expires_at', nowISO)
        .maybeSingle();

      if (sessionError || !session) {
        console.error('[create_adhoc_task] Staff session invalid or expired:', sessionError?.message || 'no matching session');
        return new Response(JSON.stringify({ error: 'Staff session expired. Please log in again.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get staff user details
      const { data: staffUser, error: staffError } = await supabase
        .from('staff_users')
        .select('id, agency_id, display_name')
        .eq('id', session.staff_user_id)
        .single();

      if (staffError || !staffUser || !staffUser.agency_id) {
        console.error('[create_adhoc_task] Staff user lookup failed:', staffError?.message || 'no agency');
        return new Response(JSON.stringify({ error: 'Staff user not found' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      authResult = {
        agencyId: staffUser.agency_id,
        staffUserId: staffUser.id,
        userId: null,
        displayName: staffUser.display_name || null,
      };
    } else if (authHeader) {
      // Agency portal request — authenticate via JWT
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

      if (!authError && user) {
        // Get user's profile for agency_id and display name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('agency_id, full_name')
          .eq('id', user.id)
          .single();

        if (!profileError && profile && profile.agency_id) {
          authResult = {
            agencyId: profile.agency_id,
            staffUserId: null,
            userId: user.id,
            displayName: profile.full_name || null,
          };
        }
      }
    }

    if (!authResult) {
      console.error('[create_adhoc_task] No valid authentication found');
      return new Response(JSON.stringify({ error: 'Unauthorized - no valid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { agencyId, staffUserId, userId, displayName } = authResult;

    // Parse request body
    const body: CreateAdhocTaskRequest = await req.json();
    const { contact_id, due_date, action_type, title, description, parent_task_id, source_module, module_record_id } = body;

    // Validate required fields
    if (!contact_id) {
      return new Response(JSON.stringify({ error: 'contact_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!due_date) {
      return new Response(JSON.stringify({ error: 'due_date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!action_type || !['call', 'text', 'email', 'other'].includes(action_type)) {
      return new Response(JSON.stringify({ error: 'action_type must be one of: call, text, email, other' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!title || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(due_date)) {
      return new Response(JSON.stringify({ error: 'due_date must be in YYYY-MM-DD format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify contact belongs to agency
    const { data: contact, error: contactError } = await supabase
      .from('agency_contacts')
      .select('id, agency_id, first_name, last_name')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('[create_adhoc_task] Contact not found:', contactError);
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (contact.agency_id !== agencyId) {
      return new Response(JSON.stringify({ error: 'Contact does not belong to your agency' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If parent_task_id provided, verify it exists and belongs to this staff user
    if (parent_task_id) {
      const { data: parentTask, error: parentError } = await supabase
        .from('onboarding_tasks')
        .select('id, agency_id, assigned_to_staff_user_id')
        .eq('id', parent_task_id)
        .single();

      if (parentError || !parentTask) {
        console.error('[create_adhoc_task] Parent task not found:', parentError);
        return new Response(JSON.stringify({ error: 'Parent task not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (parentTask.agency_id !== agencyId) {
        return new Response(JSON.stringify({ error: 'Parent task does not belong to your agency' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Determine initial status based on due_date (use agency timezone)
    const { data: agencyRow } = await supabase
      .from('agencies')
      .select('timezone')
      .eq('id', agencyId)
      .single();
    const today = localDateStr(agencyRow?.timezone || 'America/New_York');
    let status = 'pending';
    if (due_date < today) {
      status = 'overdue';
    } else if (due_date === today) {
      status = 'due';
    }

    // Create the adhoc task
    // Set the appropriate assignee field based on auth type
    const { data: newTask, error: insertError } = await supabase
      .from('onboarding_tasks')
      .insert({
        agency_id: agencyId,
        contact_id: contact_id,
        is_adhoc: true,
        parent_task_id: parent_task_id || null,
        assigned_to_staff_user_id: staffUserId || null,
        assigned_to_user_id: userId || null,
        day_number: 0, // No day number for adhoc tasks
        action_type: action_type,
        title: title.trim(),
        description: description?.trim() || null,
        due_date: due_date,
        status: status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create_adhoc_task] Failed to create task:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create task', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const assigneeInfo = staffUserId ? `staff ${staffUserId}` : `user ${userId}`;
    console.log(`[create_adhoc_task] Created adhoc task ${newTask.id} for contact ${contact_id} by ${assigneeInfo}`);

    // Log activity to contact timeline (non-blocking — task creation is the primary action)
    try {
      const activityModule = source_module || 'manual';
      const noteParts: string[] = [];
      if (description?.trim()) noteParts.push(description.trim());
      noteParts.push(`Due: ${due_date} | Type: ${action_type}`);

      const { error: activityError } = await supabase.rpc('insert_contact_activity', {
        p_agency_id: agencyId,
        p_contact_id: contact_id,
        p_source_module: activityModule,
        p_activity_type: 'task_scheduled',
        p_source_record_id: newTask.id,
        p_subject: title.trim(),
        p_notes: noteParts.join('\n'),
        p_created_by_user_id: userId || null,
        p_created_by_staff_id: staffUserId || null,
        p_created_by_display_name: displayName || null,
      });

      if (activityError) {
        console.error('[create_adhoc_task] Failed to log activity (non-fatal):', activityError.message);
      }
    } catch (activityErr) {
      console.error('[create_adhoc_task] Activity logging exception (non-fatal):', activityErr);
    }

    // Also insert into module-specific activity table so it shows in the module's own activity view
    if (source_module && module_record_id) {
      try {
        const taskNote = `Scheduled: ${title.trim()}${description ? ' — ' + description.trim() : ''}\nDue: ${due_date}`;

        if (source_module === 'cancel_audit') {
          // Look up household_key from the record
          const { data: caRecord } = await supabase
            .from('cancel_audit_records')
            .select('household_key')
            .eq('id', module_record_id)
            .eq('agency_id', agencyId)
            .single();

          if (caRecord) {
            await supabase.from('cancel_audit_activities').insert({
              agency_id: agencyId,
              record_id: module_record_id,
              household_key: caRecord.household_key,
              activity_type: 'task_scheduled',
              notes: taskNote,
              user_id: userId || null,
              // staff_member_id references team_members, not staff_users — leave null for staff
              staff_member_id: null,
              user_display_name: displayName || 'Unknown',
            });
          }
        } else if (source_module === 'renewal') {
          const { data: renewalRecord } = await supabase
            .from('renewal_records')
            .select('id')
            .eq('id', module_record_id)
            .eq('agency_id', agencyId)
            .maybeSingle();

          if (renewalRecord) {
            await supabase.from('renewal_activities').insert({
              renewal_record_id: module_record_id,
              agency_id: agencyId,
              activity_type: 'task_scheduled',
              subject: title.trim(),
              comments: `${description ? description.trim() + '\n' : ''}Due: ${due_date} | Type: ${action_type}`,
              created_by: userId || null,
              created_by_staff_id: staffUserId || null,
              created_by_display_name: displayName || null,
            });
            // Update last_activity_at on the renewal record
            await supabase.from('renewal_records').update({
              last_activity_at: new Date().toISOString(),
              last_activity_by: userId || null,
              last_activity_by_display_name: displayName || null,
              updated_at: new Date().toISOString(),
            }).eq('id', module_record_id).eq('agency_id', agencyId);
          }
        } else if (source_module === 'winback') {
          const { data: household } = await supabase
            .from('winback_households')
            .select('id')
            .eq('id', module_record_id)
            .eq('agency_id', agencyId)
            .maybeSingle();

          if (household) {
            await supabase.from('winback_activities').insert({
              household_id: module_record_id,
              agency_id: agencyId,
              activity_type: 'task_scheduled',
              notes: taskNote,
              created_by_user_id: userId || null,
              // created_by_team_member_id references team_members, not staff_users — leave null
              created_by_name: displayName || null,
            });
          }
        }
      } catch (moduleErr) {
        console.error(`[create_adhoc_task] Module activity insert failed (${source_module}, non-fatal):`, moduleErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      task: newTask,
      contact_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[create_adhoc_task] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
