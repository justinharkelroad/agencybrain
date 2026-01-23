import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get staff session token from header
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing staff session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;

    // Parse request body
    const { assignment_id, body, being, balance, business, notes } = await req.json();

    if (!assignment_id) {
      return new Response(
        JSON.stringify({ error: 'Assignment ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify assignment belongs to this staff user
    const { data: assignment, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select('id')
      .eq('id', assignment_id)
      .eq('staff_user_id', staffUserId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert Core 4 log for today
    const today = new Date().toISOString().split('T')[0];

    const { data: core4Log, error: upsertError } = await supabase
      .from('challenge_core4_logs')
      .upsert(
        {
          assignment_id: assignment_id,
          staff_user_id: staffUserId,
          log_date: today,
          body: body ?? false,
          being: being ?? false,
          balance: balance ?? false,
          business: business ?? false,
          notes: notes,
        },
        {
          onConflict: 'assignment_id,log_date',
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Core 4 upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to update Core 4 log' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate new streak
    let streak = 0;
    const { data: recentLogs } = await supabase
      .from('challenge_core4_logs')
      .select('log_date, body, being, balance, business')
      .eq('assignment_id', assignment_id)
      .order('log_date', { ascending: false })
      .limit(30);

    if (recentLogs) {
      for (const log of recentLogs) {
        if (log.body && log.being && log.balance && log.business) {
          streak++;
        } else {
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        core4: core4Log,
        streak: streak,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Core 4 update error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update Core 4' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
