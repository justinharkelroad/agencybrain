import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, attempt_id, reflection_answers } = await req.json();

    if (!session_token || !attempt_id || !reflection_answers) {
      return new Response(
        JSON.stringify({ error: 'Session token, attempt_id, and reflection_answers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id')
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update reflection answers
    const { error: updateError } = await supabase
      .from('training_quiz_attempts')
      .update({ 
        reflection_answers_final: reflection_answers,
        updated_at: new Date().toISOString()
      })
      .eq('id', attempt_id)
      .eq('staff_user_id', session.staff_user_id);

    if (updateError) {
      console.error('Failed to update reflection answers:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update reflection answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Reflection answers updated for attempt ${attempt_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Update reflection error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
