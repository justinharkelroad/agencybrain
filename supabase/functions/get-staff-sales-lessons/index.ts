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
          agency_id,
          display_name,
          email,
          team_member_id,
          team_members (
            agency_id
          )
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

    const staffUser = session.staff_users as any;
    const staffUserId = staffUser.id;
    const agencyId = staffUser.team_members?.agency_id || staffUser.agency_id;

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: 'Staff user has no agency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active Sales Experience assignment for this agency
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('*')
      .eq('agency_id', agencyId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignmentError) {
      console.error('Assignment error:', assignmentError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assignment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No active assignment
    if (!assignment || assignment.status !== 'active') {
      return new Response(
        JSON.stringify({
          has_assignment: false,
          assignment: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current business day and week
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const startDate = new Date(assignment.start_date);
    startDate.setHours(0, 0, 0, 0);

    // Check if program has started yet
    const programStarted = today >= startDate;

    let businessDays = 0;
    if (programStarted) {
      const currentDate = new Date(startDate);
      while (currentDate <= today) {
        const dow = currentDate.getDay();
        if (dow !== 0 && dow !== 6) {
          businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const currentWeek = programStarted ? Math.min(8, Math.max(1, Math.ceil(businessDays / 5))) : 0;
    const dayInWeek = programStarted ? ((businessDays - 1) % 5) + 1 : 0; // 1-5 within the week, 0 if not started

    // Get modules
    const { data: modules, error: modulesError } = await supabase
      .from('sales_experience_modules')
      .select('*')
      .order('week_number');

    if (modulesError) {
      console.error('Modules error:', modulesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch modules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get staff-visible lessons with progress
    const { data: lessonsWithProgress, error: lessonsError } = await supabase
      .from('sales_experience_lessons')
      .select(`
        *,
        sales_experience_staff_progress!inner (
          id,
          status,
          unlocked_at,
          started_at,
          completed_at,
          video_watched_seconds,
          video_completed,
          quiz_score_percent,
          quiz_feedback_ai,
          quiz_completed_at
        )
      `)
      .eq('is_staff_visible', true)
      .eq('sales_experience_staff_progress.assignment_id', assignment.id)
      .eq('sales_experience_staff_progress.staff_user_id', staffUserId)
      .order('day_of_week');

    // If no progress records exist yet, get lessons without progress
    let lessons = lessonsWithProgress;
    if (lessonsError || !lessonsWithProgress || lessonsWithProgress.length === 0) {
      const { data: allLessons, error: allLessonsError } = await supabase
        .from('sales_experience_lessons')
        .select('*')
        .eq('is_staff_visible', true)
        .order('day_of_week');

      if (allLessonsError) {
        console.error('Lessons error:', allLessonsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch lessons' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lessons = allLessons?.map((l) => ({
        ...l,
        sales_experience_staff_progress: [],
      }));
    }

    // Process lessons with time-gating logic
    const processedLessons = lessons?.map((lesson) => {
      const module = modules?.find((m) => m.id === lesson.module_id);
      const moduleWeek = module?.week_number || 1;
      const progress = Array.isArray(lesson.sales_experience_staff_progress)
        ? lesson.sales_experience_staff_progress[0]
        : lesson.sales_experience_staff_progress;

      // Time-gating logic for staff:
      // Mon (day_of_week=1) unlocks on day 1 of week
      // Wed (day_of_week=3) unlocks on day 3 of week
      // Fri (day_of_week=5) unlocks on day 5 of week
      let isUnlocked = false;
      if (!programStarted) {
        // Program hasn't started yet - nothing is unlocked
        isUnlocked = false;
      } else if (moduleWeek < currentWeek) {
        // Past weeks are fully unlocked
        isUnlocked = true;
      } else if (moduleWeek === currentWeek) {
        // Current week - check day_of_week
        // day_of_week: 1=Mon, 3=Wed, 5=Fri
        // dayInWeek: 1-5 (business day within week)
        isUnlocked = dayInWeek >= lesson.day_of_week;
      }
      // Future weeks remain locked

      // Determine effective status
      let status = progress?.status || 'locked';
      if (status === 'locked' && isUnlocked) {
        status = 'available';
      }

      return {
        id: lesson.id,
        module_id: lesson.module_id,
        day_of_week: lesson.day_of_week,
        title: lesson.title,
        description: lesson.description,
        video_url: isUnlocked ? lesson.video_url : null,
        video_platform: lesson.video_platform,
        video_thumbnail_url: lesson.video_thumbnail_url,
        content_html: isUnlocked ? lesson.content_html : null,
        quiz_questions: isUnlocked ? lesson.quiz_questions : null,
        is_discovery_flow: lesson.is_discovery_flow || false,
        week_number: moduleWeek,
        is_unlocked: isUnlocked,
        progress: {
          status,
          unlocked_at: progress?.unlocked_at || null,
          started_at: progress?.started_at || null,
          completed_at: progress?.completed_at || null,
          video_watched_seconds: progress?.video_watched_seconds || 0,
          video_completed: progress?.video_completed || false,
          quiz_score_percent: progress?.quiz_score_percent || null,
          quiz_feedback_ai: progress?.quiz_feedback_ai || null,
          quiz_completed_at: progress?.quiz_completed_at || null,
        },
      };
    });

    // Group by module/week
    const lessonsByWeek = new Map<number, any[]>();
    processedLessons?.forEach((lesson) => {
      const week = lesson.week_number;
      if (!lessonsByWeek.has(week)) {
        lessonsByWeek.set(week, []);
      }
      lessonsByWeek.get(week)!.push(lesson);
    });

    // Build weeks array with module info
    const weeks = modules?.map((module) => ({
      week_number: module.week_number,
      title: module.title,
      description: module.description,
      pillar: module.pillar,
      icon: module.icon,
      lessons: lessonsByWeek.get(module.week_number) || [],
      is_current: module.week_number === currentWeek,
      is_completed: lessonsByWeek
        .get(module.week_number)
        ?.every((l) => l.progress.status === 'completed'),
    }));

    // Calculate progress statistics
    const totalLessons = processedLessons?.length || 0;
    const completedLessons =
      processedLessons?.filter((l) => l.progress.status === 'completed').length || 0;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Get today's lesson (first unlocked, incomplete lesson)
    const todaysLesson = processedLessons?.find(
      (l) => l.is_unlocked && l.progress.status !== 'completed'
    );

    return new Response(
      JSON.stringify({
        has_assignment: true,
        program_started: programStarted,
        assignment: {
          id: assignment.id,
          status: assignment.status,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
        },
        current_week: programStarted ? currentWeek : 1, // Show week 1 in UI even if not started
        current_business_day: businessDays,
        day_in_week: dayInWeek,
        weeks,
        todays_lesson: todaysLesson || null,
        progress: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
        },
        staff_name: staffUser.display_name || 'Team Member',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get staff sales lessons error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch sales lessons' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
