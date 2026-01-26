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
      .select(`
        staff_user_id,
        expires_at,
        staff_users (
          id,
          agency_id
        )
      `)
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

    const staffUser = session.staff_users as unknown as { id: string; agency_id: string };
    const staffUserId = staffUser.id;

    // Parse request body
    const { assignment_id, lesson_id, reflection_responses } = await req.json();

    if (!assignment_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'Missing assignment_id or lesson_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the assignment belongs to this staff user
    const { data: assignment, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select('id, status')
      .eq('id', assignment_id)
      .eq('staff_user_id', staffUserId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found or unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed
    const { data: existingProgress, error: progressCheckError } = await supabase
      .from('challenge_progress')
      .select('id, status')
      .eq('assignment_id', assignment_id)
      .eq('lesson_id', lesson_id)
      .single();

    if (progressCheckError && progressCheckError.code !== 'PGRST116') {
      console.error('Progress check error:', progressCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to check progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingProgress?.status === 'completed') {
      return new Response(
        JSON.stringify({ 
          error: 'Lesson already completed',
          already_completed: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or insert progress
    const now = new Date().toISOString();
    
    if (existingProgress) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('challenge_progress')
        .update({
          status: 'completed',
          completed_at: now,
          reflection_response: reflection_responses || {},
          updated_at: now,
        })
        .eq('id', existingProgress.id);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to complete lesson' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('challenge_progress')
        .insert({
          assignment_id,
          lesson_id,
          staff_user_id: staffUserId,
          status: 'completed',
          started_at: now,
          completed_at: now,
          reflection_response: reflection_responses || {},
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to complete lesson' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get updated progress stats
    const { data: allProgress } = await supabase
      .from('challenge_progress')
      .select('status')
      .eq('assignment_id', assignment_id);

    const completedCount = allProgress?.filter(p => p.status === 'completed').length || 0;

    // Get total lessons for this assignment's product
    const { data: assignmentWithProduct } = await supabase
      .from('challenge_assignments')
      .select('challenge_products(total_lessons)')
      .eq('id', assignment_id)
      .single();

    const totalLessons = (assignmentWithProduct?.challenge_products as unknown as { total_lessons: number })?.total_lessons || 30;

    return new Response(
      JSON.stringify({
        success: true,
        progress: {
          completed_lessons: completedCount,
          total_lessons: totalLessons,
          progress_percent: Math.round((completedCount / totalLessons) * 100),
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
