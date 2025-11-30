import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('*, staff_users!inner(*)')
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_users.id;

    // Fetch lesson progress
    const { data: lessonProgress, error: lessonError } = await supabase
      .from('staff_lesson_progress')
      .select('*')
      .eq('staff_user_id', staffUserId);

    if (lessonError) {
      console.error('Error fetching lesson progress:', lessonError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch lesson progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch quiz attempts
    const { data: quizAttempts, error: quizError } = await supabase
      .from('staff_quiz_attempts')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .order('created_at', { ascending: false });

    if (quizError) {
      console.error('Error fetching quiz attempts:', quizError);
    }

    // Transform lesson_progress to match frontend expectations
    const progress = (lessonProgress || []).map(lp => ({
      lesson_id: lp.lesson_id,
      completed: lp.is_completed,
      completed_at: lp.completed_at
    }));

    return new Response(
      JSON.stringify({
        progress: progress,
        quiz_attempts: quizAttempts || [],
        staff_user_id: staffUserId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_training_progress:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
