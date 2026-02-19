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
    const {
      assignment_id,
      sunday_module_id,
      sunday_number,
      rating_body,
      rating_being,
      rating_balance,
      rating_business,
      accomplished_body,
      accomplished_being,
      accomplished_balance,
      accomplished_business,
      commitment_body,
      commitment_being,
      commitment_balance,
      commitment_business,
      final_reflection,
    } = await req.json();

    if (!assignment_id || !sunday_module_id || sunday_number === undefined) {
      return new Response(
        JSON.stringify({ error: 'assignment_id, sunday_module_id, and sunday_number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify assignment belongs to this staff user
    // Allow active, pending, AND completed (so Sunday 6 can be submitted after all lessons are done)
    const { data: assignment, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select('id, start_date, status, challenge_product_id')
      .eq('id', assignment_id)
      .eq('staff_user_id', staffUserId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['active', 'pending', 'completed'].includes(assignment.status)) {
      return new Response(
        JSON.stringify({ error: 'Assignment is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Sunday module exists and belongs to same product
    const { data: sundayModule, error: moduleError } = await supabase
      .from('challenge_sunday_modules')
      .select('id, sunday_number, challenge_product_id')
      .eq('id', sunday_module_id)
      .eq('challenge_product_id', assignment.challenge_product_id)
      .single();

    if (moduleError || !sundayModule) {
      return new Response(
        JSON.stringify({ error: 'Sunday module not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify sunday_number matches
    if (sundayModule.sunday_number !== sunday_number) {
      return new Response(
        JSON.stringify({ error: 'Sunday number mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check unlock: Sunday 0 always unlocked, Sunday N unlocked when today >= start_date + (N * 7) - 1
    const today = new Date();
    const startDate = new Date(assignment.start_date);
    if (sunday_number > 0) {
      const unlockDate = new Date(startDate);
      unlockDate.setDate(unlockDate.getDate() + (sunday_number * 7) - 1);
      if (today < unlockDate) {
        return new Response(
          JSON.stringify({ error: 'Sunday module is not yet unlocked' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upsert into challenge_sunday_responses
    const { data: response, error: upsertError } = await supabase
      .from('challenge_sunday_responses')
      .upsert(
        {
          assignment_id,
          sunday_module_id,
          staff_user_id: staffUserId,
          sunday_number,
          rating_body: rating_body ?? null,
          rating_being: rating_being ?? null,
          rating_balance: rating_balance ?? null,
          rating_business: rating_business ?? null,
          accomplished_body: accomplished_body ?? null,
          accomplished_being: accomplished_being ?? null,
          accomplished_balance: accomplished_balance ?? null,
          accomplished_business: accomplished_business ?? null,
          commitment_body: commitment_body ?? null,
          commitment_being: commitment_being ?? null,
          commitment_balance: commitment_balance ?? null,
          commitment_business: commitment_business ?? null,
          final_reflection: final_reflection ?? null,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'assignment_id,sunday_number' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Sunday response upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        response,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete sunday error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to complete Sunday module' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
