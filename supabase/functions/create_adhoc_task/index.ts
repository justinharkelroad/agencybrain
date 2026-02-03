import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
}

interface AuthResult {
  agencyId: string;
  staffUserId: string | null;
  userId: string | null;
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

    // Try to authenticate via staff session OR JWT
    const sessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('authorization');

    let authResult: AuthResult | null = null;

    // Try staff session first
    if (sessionToken) {
      const nowISO = new Date().toISOString();
      const { data: session, error: sessionError } = await supabase
        .from('staff_sessions')
        .select('staff_user_id, expires_at, is_valid')
        .eq('session_token', sessionToken)
        .eq('is_valid', true)
        .gt('expires_at', nowISO)
        .maybeSingle();

      if (!sessionError && session) {
        // Get staff user details
        const { data: staffUser, error: staffError } = await supabase
          .from('staff_users')
          .select('id, agency_id, display_name')
          .eq('id', session.staff_user_id)
          .single();

        if (!staffError && staffUser && staffUser.agency_id) {
          authResult = {
            agencyId: staffUser.agency_id,
            staffUserId: staffUser.id,
            userId: null,
          };
        }
      }
    }

    // Try JWT auth if staff session didn't work
    if (!authResult && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (!authError && user) {
        // Get user's profile for agency_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (!profileError && profile && profile.agency_id) {
          authResult = {
            agencyId: profile.agency_id,
            staffUserId: null,
            userId: user.id,
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

    const { agencyId, staffUserId, userId } = authResult;

    // Parse request body
    const body: CreateAdhocTaskRequest = await req.json();
    const { contact_id, due_date, action_type, title, description, parent_task_id } = body;

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

    // Determine initial status based on due_date
    const today = new Date().toISOString().split('T')[0];
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
