import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CompleteTaskRequest {
  task_id: string;
  notes?: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get session token from header
    const sessionToken = req.headers.get('x-staff-session');

    if (!sessionToken) {
      console.error('[complete_staff_onboarding_task] No session token provided');
      return new Response(JSON.stringify({ error: 'Unauthorized - no session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const nowISO = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', nowISO)
      .maybeSingle();

    if (sessionError) {
      console.error('[complete_staff_onboarding_task] Session verification failed:', sessionError);
      return new Response(JSON.stringify({ error: 'Unauthorized - session error' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session) {
      console.error('[complete_staff_onboarding_task] No valid session found');
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired session' }), {
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

    if (staffError || !staffUser) {
      console.error('[complete_staff_onboarding_task] Staff user lookup failed:', staffError);
      return new Response(JSON.stringify({ error: 'Unauthorized - staff user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const agencyId = staffUser.agency_id;
    const staffUserId = staffUser.id;

    if (!agencyId) {
      return new Response(JSON.stringify({ error: 'Staff user has no agency' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body: CompleteTaskRequest = await req.json();
    const { task_id, notes } = body;

    if (!task_id) {
      return new Response(JSON.stringify({ error: 'task_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch the task and verify it belongs to this staff user
    const { data: task, error: taskError } = await supabase
      .from('onboarding_tasks')
      .select('id, agency_id, status, instance_id, assigned_to_staff_user_id')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      console.error('[complete_staff_onboarding_task] Task not found:', taskError);
      return new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security check: Task must belong to this agency
    if (task.agency_id !== agencyId) {
      return new Response(JSON.stringify({ error: 'Task does not belong to your agency' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security check: Task must be assigned to this staff user
    if (task.assigned_to_staff_user_id !== staffUserId) {
      return new Response(JSON.stringify({ error: 'Task is not assigned to you' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (task.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Task is already completed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update the task to completed
    // Note: completed_by stores the staff_user_id (not a profiles.id since staff users don't have auth.uid)
    const { error: updateError } = await supabase
      .from('onboarding_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: staffUserId, // Store staff_user_id for staff portal completions
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task_id);

    if (updateError) {
      console.error('[complete_staff_onboarding_task] Failed to update task:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to complete task', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if all tasks in the instance are now completed
    const { data: remainingTasks, error: remainingError } = await supabase
      .from('onboarding_tasks')
      .select('id')
      .eq('instance_id', task.instance_id)
      .neq('status', 'completed');

    if (!remainingError && remainingTasks && remainingTasks.length === 0) {
      // All tasks completed - update instance status
      await supabase
        .from('onboarding_instances')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.instance_id);

      console.log(`[complete_staff_onboarding_task] Instance ${task.instance_id} completed - all tasks done`);
    }

    console.log(`[complete_staff_onboarding_task] Task ${task_id} completed by staff user ${staffUserId}`);

    return new Response(JSON.stringify({
      success: true,
      task_id: task_id,
      instance_completed: remainingTasks?.length === 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[complete_staff_onboarding_task] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
