import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CRON Job: Update Onboarding Task Statuses
 *
 * This function should be called daily (e.g., at midnight UTC or early morning)
 * to update task statuses based on their due dates:
 * - Tasks with due_date = today → status = 'due'
 * - Tasks with due_date < today → status = 'overdue'
 *
 * Only updates tasks that are currently 'pending' or 'due' (not already completed)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client (this is a CRON job, no user auth)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in UTC (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];

    console.log(`[update_onboarding_task_statuses] Running status update for date: ${today}`);

    // Update tasks that are overdue (due_date < today, status is pending or due)
    const { data: overdueUpdated, error: overdueError } = await supabase
      .from('onboarding_tasks')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      })
      .lt('due_date', today)
      .in('status', ['pending', 'due'])
      .select('id');

    if (overdueError) {
      console.error('[update_onboarding_task_statuses] Error updating overdue tasks:', overdueError);
      return new Response(
        JSON.stringify({ error: 'Failed to update overdue tasks', details: overdueError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const overdueCount = overdueUpdated?.length || 0;
    console.log(`[update_onboarding_task_statuses] Marked ${overdueCount} tasks as overdue`);

    // Update tasks that are due today (due_date = today, status is pending)
    const { data: dueUpdated, error: dueError } = await supabase
      .from('onboarding_tasks')
      .update({
        status: 'due',
        updated_at: new Date().toISOString(),
      })
      .eq('due_date', today)
      .eq('status', 'pending')
      .select('id');

    if (dueError) {
      console.error('[update_onboarding_task_statuses] Error updating due tasks:', dueError);
      return new Response(
        JSON.stringify({ error: 'Failed to update due tasks', details: dueError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dueCount = dueUpdated?.length || 0;
    console.log(`[update_onboarding_task_statuses] Marked ${dueCount} tasks as due`);

    // Get summary stats for logging
    const { count: totalPending } = await supabase
      .from('onboarding_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: totalDue } = await supabase
      .from('onboarding_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'due');

    const { count: totalOverdue } = await supabase
      .from('onboarding_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'overdue');

    console.log(`[update_onboarding_task_statuses] Current totals - Pending: ${totalPending}, Due: ${totalDue}, Overdue: ${totalOverdue}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        updated: {
          marked_overdue: overdueCount,
          marked_due: dueCount,
        },
        totals: {
          pending: totalPending || 0,
          due: totalDue || 0,
          overdue: totalOverdue || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update_onboarding_task_statuses] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
