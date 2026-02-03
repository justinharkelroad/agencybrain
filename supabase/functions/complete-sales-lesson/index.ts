import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ActionType = 'start' | 'complete' | 'update_video';

interface RequestBody {
  lesson_id: string;
  action: ActionType;
  video_watched_seconds?: number;
  video_completed?: boolean;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for staff session first
    const staffSessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('Authorization');

    let userId: string | null = null;
    let staffUserId: string | null = null;
    let agencyId: string | null = null;
    let isStaff = false;

    if (staffSessionToken) {
      // Staff user
      const { data: session, error: sessionError } = await supabase
        .from('staff_sessions')
        .select(`
          staff_user_id,
          expires_at,
          staff_users (
            id,
            team_member_id,
            team_members (
              agency_id
            )
          )
        `)
        .eq('session_token', staffSessionToken)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired staff session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const staffUser = session.staff_users as any;
      staffUserId = staffUser.id;
      agencyId = staffUser.team_members?.agency_id;
      isStaff = true;
    } else if (authHeader) {
      // Owner/Manager user
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = user.id;

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', user.id)
        .single();

      // Check if user is admin (by role)
      const isAdmin = profile?.role === 'admin';

      // Check if user is agency owner (by having agency_id)
      const isAgencyOwner = !!profile?.agency_id;

      // Check if user is key employee
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const isKeyEmployee = !!keyEmployee;

      if (!isAdmin && !isAgencyOwner && !isKeyEmployee) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use key employee's agency if they don't have one directly
      agencyId = profile?.agency_id || keyEmployee?.agency_id || null;
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { lesson_id, action, video_watched_seconds, video_completed, notes } = body;

    if (!lesson_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing lesson_id or action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['start', 'complete', 'update_video'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be: start, complete, or update_video' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active assignment for this agency
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'No active assignment found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify lesson exists
    const { data: lesson, error: lessonError } = await supabase
      .from('sales_experience_lessons')
      .select('*, sales_experience_modules!inner(week_number)')
      .eq('id', lesson_id)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For staff, verify lesson is unlocked (time-gating)
    if (isStaff) {
      const moduleWeek = lesson.sales_experience_modules.week_number;
      const today = new Date();
      const startDate = new Date(assignment.start_date);
      let businessDays = 0;
      const currentDate = new Date(startDate);

      while (currentDate <= today) {
        const dow = currentDate.getDay();
        if (dow !== 0 && dow !== 6) {
          businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const currentWeek = Math.min(8, Math.max(1, Math.ceil(businessDays / 5)));
      const dayInWeek = ((businessDays - 1) % 5) + 1;

      const isUnlocked =
        moduleWeek < currentWeek ||
        (moduleWeek === currentWeek && dayInWeek >= lesson.day_of_week);

      if (!isUnlocked) {
        return new Response(
          JSON.stringify({ error: 'This lesson is not yet available' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const now = new Date().toISOString();
    let result;

    if (isStaff) {
      // Update staff progress
      const updateData: any = {
        assignment_id: assignment.id,
        staff_user_id: staffUserId,
        lesson_id,
      };

      if (action === 'start') {
        updateData.status = 'in_progress';
        updateData.started_at = now;
        updateData.unlocked_at = now;
      } else if (action === 'complete') {
        updateData.status = 'completed';
        updateData.completed_at = now;
      } else if (action === 'update_video') {
        if (video_watched_seconds !== undefined) {
          updateData.video_watched_seconds = video_watched_seconds;
        }
        if (video_completed !== undefined) {
          updateData.video_completed = video_completed;
        }
      }

      const { data, error } = await supabase
        .from('sales_experience_staff_progress')
        .upsert(updateData, {
          onConflict: 'assignment_id,staff_user_id,lesson_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Staff progress update error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update progress' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = data;
    } else {
      // Update owner progress
      const updateData: any = {
        assignment_id: assignment.id,
        user_id: userId,
        lesson_id,
      };

      if (action === 'start') {
        updateData.status = 'in_progress';
        updateData.started_at = now;
      } else if (action === 'complete') {
        updateData.status = 'completed';
        updateData.completed_at = now;
      } else if (action === 'update_video') {
        if (video_watched_seconds !== undefined) {
          updateData.video_watched_seconds = video_watched_seconds;
        }
        if (video_completed !== undefined) {
          updateData.video_completed = video_completed;
        }
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data, error } = await supabase
        .from('sales_experience_owner_progress')
        .upsert(updateData, {
          onConflict: 'assignment_id,lesson_id,user_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Owner progress update error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update progress' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        progress: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Complete sales lesson error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update lesson progress' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
