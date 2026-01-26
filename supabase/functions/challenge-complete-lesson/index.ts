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
    const { assignment_id, lesson_id, reflection_response, video_watched_seconds, video_completed } = await req.json();

    if (!assignment_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'Assignment ID and Lesson ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify assignment belongs to this staff user and is active
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

    if (assignment.status !== 'active' && assignment.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Assignment is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify lesson exists and get day_number
    const { data: lesson, error: lessonError } = await supabase
      .from('challenge_lessons')
      .select('id, day_number, challenge_product_id')
      .eq('id', lesson_id)
      .eq('challenge_product_id', assignment.challenge_product_id)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current business day to verify lesson is unlocked
    const today = new Date();
    const startDate = new Date(assignment.start_date);
    let businessDay = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dow = currentDate.getDay();
      if (dow !== 0 && dow !== 6) {
        businessDay++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (lesson.day_number > businessDay) {
      return new Response(
        JSON.stringify({ error: 'Lesson is not yet unlocked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing progress record
    const { data: existingProgress, error: progressError } = await supabase
      .from('challenge_progress')
      .select('id, status, started_at')
      .eq('assignment_id', assignment_id)
      .eq('lesson_id', lesson_id)
      .single();

    if (progressError || !existingProgress) {
      return new Response(
        JSON.stringify({ error: 'Progress record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update progress record to completed
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      status: 'completed',
      completed_at: now,
    };

    // Set started_at if not already set
    if (!existingProgress.started_at) {
      updateData.started_at = now;
    }

    // Store reflection response if provided
    if (reflection_response && typeof reflection_response === 'object') {
      updateData.reflection_response = reflection_response;
    }

    // Store video tracking if provided
    if (typeof video_watched_seconds === 'number') {
      updateData.video_watched_seconds = video_watched_seconds;
    }
    if (typeof video_completed === 'boolean') {
      updateData.video_completed = video_completed;
    }

    const { data: updatedProgress, error: updateError } = await supabase
      .from('challenge_progress')
      .update(updateData)
      .eq('id', existingProgress.id)
      .select()
      .single();

    if (updateError) {
      console.error('Progress update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate updated progress statistics
    const { data: allProgress, error: statsError } = await supabase
      .from('challenge_progress')
      .select('status')
      .eq('assignment_id', assignment_id);

    const totalLessons = allProgress?.length || 0;
    const completedLessons = allProgress?.filter(p => p.status === 'completed').length || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Check if all lessons are completed
    if (completedLessons === totalLessons && totalLessons > 0) {
      // Update assignment status to completed
      await supabase
        .from('challenge_assignments')
        .update({ status: 'completed' })
        .eq('id', assignment_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        progress: updatedProgress,
        stats: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete lesson error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to complete lesson' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
