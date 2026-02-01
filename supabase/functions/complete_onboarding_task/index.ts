import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteTaskRequest {
  task_id: string;
  notes?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon key with user's auth for verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's agency_id
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'User has no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CompleteTaskRequest = await req.json();
    const { task_id, notes } = body;

    if (!task_id) {
      return new Response(
        JSON.stringify({ error: 'task_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the task and verify it belongs to this agency
    const { data: task, error: taskError } = await supabase
      .from('onboarding_tasks')
      .select('id, agency_id, status, instance_id')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      console.error('[complete_onboarding_task] Task not found:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (task.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Task does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (task.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Task is already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the task to completed
    const { error: updateError } = await supabase
      .from('onboarding_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_user_id: user.id,
        completion_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task_id);

    if (updateError) {
      console.error('[complete_onboarding_task] Failed to update task:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to complete task', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

      console.log(`[complete_onboarding_task] Instance ${task.instance_id} completed - all tasks done`);
    }

    console.log(`[complete_onboarding_task] Task ${task_id} completed by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        task_id: task_id,
        instance_completed: remainingTasks?.length === 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[complete_onboarding_task] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
