import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReassignSequenceRequest {
  instance_id: string;
  new_assignee_staff_user_id: string;
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

    // Get user's agency_id and role
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('agency_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: 'User has no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only owners and admins can reassign sequences
    if (profile.role !== 'owner' && profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only owners and admins can reassign sequences' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ReassignSequenceRequest = await req.json();
    const { instance_id, new_assignee_staff_user_id } = body;

    // Validate required fields
    if (!instance_id || !new_assignee_staff_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: instance_id and new_assignee_staff_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the instance exists and belongs to this agency
    const { data: instance, error: instanceError } = await supabase
      .from('onboarding_instances')
      .select('id, agency_id, status, assigned_to_staff_user_id, customer_name')
      .eq('id', instance_id)
      .single();

    if (instanceError || !instance) {
      console.error('[reassign_onboarding_sequence] Instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Onboarding instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Instance does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Cannot reassign a completed or cancelled sequence' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the new assignee exists and belongs to this agency
    const { data: newAssignee, error: assigneeError } = await supabase
      .from('staff_users')
      .select('id, agency_id, is_active, display_name, username')
      .eq('id', new_assignee_staff_user_id)
      .single();

    if (assigneeError || !newAssignee) {
      console.error('[reassign_onboarding_sequence] New assignee not found:', assigneeError);
      return new Response(
        JSON.stringify({ error: 'New assignee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newAssignee.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'New assignee does not belong to your agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newAssignee.is_active) {
      return new Response(
        JSON.stringify({ error: 'Cannot assign to an inactive staff user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already assigned to the same person
    if (instance.assigned_to_staff_user_id === new_assignee_staff_user_id) {
      return new Response(
        JSON.stringify({ error: 'Sequence is already assigned to this staff member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the instance assignment
    const { error: instanceUpdateError } = await supabase
      .from('onboarding_instances')
      .update({
        assigned_to_staff_user_id: new_assignee_staff_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance_id);

    if (instanceUpdateError) {
      console.error('[reassign_onboarding_sequence] Failed to update instance:', instanceUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update instance assignment', details: instanceUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update all pending/due/overdue tasks to the new assignee
    const { data: updatedTasks, error: tasksUpdateError } = await supabase
      .from('onboarding_tasks')
      .update({
        assigned_to_staff_user_id: new_assignee_staff_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('instance_id', instance_id)
      .in('status', ['pending', 'due', 'overdue'])
      .select('id');

    if (tasksUpdateError) {
      console.error('[reassign_onboarding_sequence] Failed to update tasks:', tasksUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update task assignments', details: tasksUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tasksUpdatedCount = updatedTasks?.length || 0;
    const newAssigneeName = newAssignee.display_name || newAssignee.username;

    console.log(`[reassign_onboarding_sequence] Instance ${instance_id} reassigned to ${newAssigneeName}, ${tasksUpdatedCount} tasks updated`);

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instance_id,
        new_assignee_id: new_assignee_staff_user_id,
        new_assignee_name: newAssigneeName,
        tasks_reassigned: tasksUpdatedCount,
        customer_name: instance.customer_name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reassign_onboarding_sequence] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
