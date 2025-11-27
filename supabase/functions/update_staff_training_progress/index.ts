import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, lesson_id, status, progress_data } = await req.json();

    if (!session_token || !lesson_id || !status) {
      return new Response(
        JSON.stringify({ error: 'Session token, lesson_id, and status required' }),
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

    // Upsert lesson progress
    const progressRecord = {
      staff_user_id: staffUserId,
      lesson_id: lesson_id,
      status: status,
      progress_data: progress_data || {},
      last_accessed_at: new Date().toISOString()
    };

    if (status === 'completed') {
      progressRecord['completed_at'] = new Date().toISOString();
    }

    const { data: progress, error: progressError } = await supabase
      .from('staff_lesson_progress')
      .upsert(progressRecord, {
        onConflict: 'staff_user_id,lesson_id'
      })
      .select()
      .single();

    if (progressError) {
      console.error('Error updating progress:', progressError);
      return new Response(
        JSON.stringify({ error: 'Failed to update progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Progress updated successfully for staff user:', staffUserId, 'lesson:', lesson_id);

    return new Response(
      JSON.stringify({
        success: true,
        progress: progress
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update_staff_training_progress:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
