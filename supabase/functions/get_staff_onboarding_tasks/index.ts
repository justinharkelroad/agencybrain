import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OnboardingTask {
  id: string;
  instance_id: string;
  step_id: string | null;
  agency_id: string;
  assigned_to_staff_user_id: string;
  day_number: number;
  action_type: string;
  title: string;
  description: string | null;
  script_template: string | null;
  due_date: string;
  status: string;
  completed_at: string | null;
  completed_by_user_id: string | null;
  completed_by_staff_user_id: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
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
      console.error('[get_staff_onboarding_tasks] No session token provided');
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
      console.error('[get_staff_onboarding_tasks] Session verification failed:', sessionError);
      return new Response(JSON.stringify({ error: 'Unauthorized - session error' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session) {
      console.error('[get_staff_onboarding_tasks] No valid session found');
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get staff user details
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, agency_id, team_member_id, display_name, username')
      .eq('id', session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error('[get_staff_onboarding_tasks] Staff user lookup failed:', staffError);
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

    // Parse request body for optional filters
    const body = await req.json().catch(() => ({}));
    const { include_completed_today = true } = body;

    // Get today's date for completed_today filter
    const today = new Date().toISOString().split('T')[0];

    // Fetch active tasks (pending, due, overdue) assigned to this staff user
    // Use left join to include adhoc tasks that don't have an instance
    const { data: activeTasks, error: activeError } = await supabase
      .from('onboarding_tasks')
      .select(`
        *,
        instance:onboarding_instances(
          id,
          customer_name,
          customer_phone,
          customer_email,
          sale_id,
          contact_id,
          sequence:onboarding_sequences(id, name)
        ),
        contact:agency_contacts(
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .eq('agency_id', agencyId)
      .eq('assigned_to_staff_user_id', staffUserId)
      .in('status', ['pending', 'due', 'overdue'])
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (activeError) {
      console.error('[get_staff_onboarding_tasks] Error fetching active tasks:', activeError);
      return new Response(JSON.stringify({ error: 'Failed to fetch tasks', details: activeError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch tasks completed today (if requested)
    // Use left join to include adhoc tasks that don't have an instance
    let completedTodayTasks: any[] = [];
    if (include_completed_today) {
      const { data: completedTasks, error: completedError } = await supabase
        .from('onboarding_tasks')
        .select(`
          *,
          instance:onboarding_instances(
            id,
            customer_name,
            customer_phone,
            customer_email,
            sale_id,
            contact_id,
            sequence:onboarding_sequences(id, name)
          ),
          contact:agency_contacts(
            id,
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq('agency_id', agencyId)
        .eq('assigned_to_staff_user_id', staffUserId)
        .eq('status', 'completed')
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59.999`)
        .order('completed_at', { ascending: false });

      if (completedError) {
        console.error('[get_staff_onboarding_tasks] Error fetching completed tasks:', completedError);
        // Non-fatal - continue without completed tasks
      } else {
        completedTodayTasks = completedTasks || [];
      }
    }

    // Calculate stats
    const stats = {
      overdue: (activeTasks || []).filter((t: any) => t.status === 'overdue').length,
      due_today: (activeTasks || []).filter((t: any) => t.status === 'due').length,
      upcoming: (activeTasks || []).filter((t: any) => t.status === 'pending').length,
      completed_today: completedTodayTasks.length,
    };

    console.log(`[get_staff_onboarding_tasks] Found ${activeTasks?.length || 0} active tasks, ${completedTodayTasks.length} completed today for staff ${staffUserId}`);

    return new Response(JSON.stringify({
      active_tasks: activeTasks || [],
      completed_today_tasks: completedTodayTasks,
      stats,
      staff_user_id: staffUserId,
      agency_id: agencyId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[get_staff_onboarding_tasks] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
