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
          team_member_id
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
    const agencyId = staffUser.agency_id;

    // Get active challenge assignment for this staff member
    // Include 'completed' status so Sunday modules remain accessible after all 30 lessons are done
    const { data: assignment, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select(`
        *,
        challenge_products (
          id,
          name,
          slug,
          description,
          total_lessons,
          duration_weeks
        )
      `)
      .eq('staff_user_id', staffUserId)
      .in('status', ['active', 'pending', 'completed'])
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

    // If no assignment, return early
    if (!assignment) {
      return new Response(
        JSON.stringify({
          has_assignment: false,
          assignment: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current business day
    const today = new Date();
    const startDate = new Date(assignment.start_date);

    // Count business days between start and today
    let businessDay = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dow = currentDate.getDay();
      if (dow !== 0 && dow !== 6) {
        businessDay++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get all lessons with progress
    const { data: lessons, error: lessonsError } = await supabase
      .from('challenge_lessons')
      .select(`
        id,
        title,
        day_number,
        week_number,
        day_of_week,
        video_url,
        video_thumbnail_url,
        preview_text,
        content_html,
        questions,
        action_items,
        is_discovery_flow,
        challenge_progress!inner (
          id,
          status,
          unlocked_at,
          started_at,
          completed_at,
          video_watched_seconds,
          video_completed,
          reflection_response
        )
      `)
      .eq('challenge_product_id', assignment.challenge_product_id)
      .eq('challenge_progress.assignment_id', assignment.id)
      .order('day_number');

    if (lessonsError) {
      console.error('Lessons error:', lessonsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch lessons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get modules for grouping
    const { data: modules, error: modulesError } = await supabase
      .from('challenge_modules')
      .select('*')
      .eq('challenge_product_id', assignment.challenge_product_id)
      .order('week_number');

    if (modulesError) {
      console.error('Modules error:', modulesError);
    }

    // Calculate progress statistics
    const totalLessons = lessons?.length || 0;
    const completedLessons = lessons?.filter(l =>
      (l.challenge_progress as any[])?.[0]?.status === 'completed'
    ).length || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Get today's lesson
    const todaysLesson = lessons?.find(l => l.day_number === businessDay);

    // Look up discovery flow template for Friday lesson detection
    let discoveryTemplateId: string | null = null;
    const hasDiscoveryLessons = lessons?.some(l => l.is_discovery_flow);
    if (hasDiscoveryLessons) {
      const { data: discoveryTemplate } = await supabase
        .from('flow_templates')
        .select('id')
        .eq('slug', 'discovery')
        .single();
      discoveryTemplateId = discoveryTemplate?.id || null;
    }

    // Fetch all completed discovery flow sessions for this staff user (for Friday lesson gating)
    let completedDiscoverySessions: Array<{ id: string; completed_at: string }> = [];
    if (discoveryTemplateId) {
      const { data: sessions } = await supabase
        .from('staff_flow_sessions')
        .select('id, completed_at')
        .eq('staff_user_id', staffUserId)
        .eq('flow_template_id', discoveryTemplateId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true });
      completedDiscoverySessions = sessions || [];
    }

    // Helper: calculate the calendar date when a given business day unlocks
    const getUnlockDate = (dayNumber: number): Date => {
      let bDay = 0;
      const d = new Date(startDate);
      while (bDay < dayNumber) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          bDay++;
        }
        if (bDay < dayNumber) {
          d.setDate(d.getDate() + 1);
        }
      }
      const result = new Date(d);
      result.setHours(0, 0, 0, 0);
      return result;
    };

    // Update lesson statuses based on current business day
    const processedLessons = lessons?.map(lesson => {
      const progress = (lesson.challenge_progress as any[])?.[0];
      let status = progress?.status || 'locked';

      // Unlock lessons up to current business day if still locked
      if (status === 'locked' && lesson.day_number <= businessDay) {
        status = 'available';
      }

      // For discovery flow lessons, check if staff completed a discovery flow on or after unlock date
      let discoveryFlowCompleted = false;
      if (lesson.is_discovery_flow && completedDiscoverySessions.length > 0) {
        const unlockDate = getUnlockDate(lesson.day_number);
        discoveryFlowCompleted = completedDiscoverySessions.some(
          s => new Date(s.completed_at) >= unlockDate
        );
      }

      return {
        ...lesson,
        challenge_progress: {
          ...progress,
          status,
          is_unlocked: lesson.day_number <= businessDay,
          is_today: lesson.day_number === businessDay,
          discovery_flow_completed: lesson.is_discovery_flow ? discoveryFlowCompleted : undefined,
        },
      };
    });

    // Get Core 4 from the unified staff_core4_entries table
    const todayStr = today.toISOString().split('T')[0];
    const { data: core4Today } = await supabase
      .from('staff_core4_entries')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .eq('date', todayStr)
      .maybeSingle();

    // Calculate Core 4 streak from staff_core4_entries
    let core4Streak = 0;
    const { data: core4Logs } = await supabase
      .from('staff_core4_entries')
      .select('date, body_completed, being_completed, balance_completed, business_completed')
      .eq('staff_user_id', staffUserId)
      .order('date', { ascending: false })
      .limit(30);

    if (core4Logs) {
      for (const log of core4Logs) {
        if (log.body_completed && log.being_completed && log.balance_completed && log.business_completed) {
          core4Streak++;
        } else {
          break;
        }
      }
    }

    // ── Sunday Modules ──────────────────────────────────────
    // Fetch module definitions
    const { data: sundayModules, error: sundayModulesError } = await supabase
      .from('challenge_sunday_modules')
      .select('*')
      .eq('challenge_product_id', assignment.challenge_product_id)
      .order('sunday_number');

    if (sundayModulesError) {
      console.error('Sunday modules error:', sundayModulesError);
    }

    // Fetch existing responses for this assignment
    const { data: sundayResponses, error: sundayResponsesError } = await supabase
      .from('challenge_sunday_responses')
      .select('*')
      .eq('assignment_id', assignment.id)
      .order('sunday_number');

    if (sundayResponsesError) {
      console.error('Sunday responses error:', sundayResponsesError);
    }

    // Build response map for quick lookup
    const responseMap = new Map<number, any>();
    if (sundayResponses) {
      for (const r of sundayResponses) {
        responseMap.set(r.sunday_number, r);
      }
    }

    // Calculate unlock status and attach previous commitments
    const processedSundayModules = (sundayModules || []).map((mod: any) => {
      // Unlock logic:
      // Sunday 0: always unlocked
      // Sunday N (1-6): unlocked when today >= start_date + (N * 7) - 1 days
      let isUnlocked = false;
      if (mod.sunday_number === 0) {
        isUnlocked = true;
      } else {
        const unlockDate = new Date(startDate);
        unlockDate.setDate(unlockDate.getDate() + (mod.sunday_number * 7) - 1);
        isUnlocked = today >= unlockDate;
      }

      const response = responseMap.get(mod.sunday_number) || null;
      const isCompleted = !!response;

      // For modules with rating section, attach previous commitments
      let previousCommitments: { body: string | null; being: string | null; balance: string | null; business: string | null } | null = null;
      if (mod.has_rating_section && mod.sunday_number > 0) {
        const prevResponse = responseMap.get(mod.sunday_number - 1);
        if (prevResponse) {
          previousCommitments = {
            body: prevResponse.commitment_body,
            being: prevResponse.commitment_being,
            balance: prevResponse.commitment_balance,
            business: prevResponse.commitment_business,
          };
        }
      }

      return {
        ...mod,
        is_unlocked: isUnlocked,
        is_completed: isCompleted,
        response,
        previous_commitments: previousCommitments,
      };
    });

    return new Response(
      JSON.stringify({
        has_assignment: true,
        assignment: {
          id: assignment.id,
          status: assignment.status,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          timezone: assignment.timezone,
          product: assignment.challenge_products,
        },
        current_business_day: businessDay,
        todays_lesson: todaysLesson ? {
          ...todaysLesson,
          progress: (todaysLesson.challenge_progress as any[])?.[0],
        } : null,
        modules: modules || [],
        lessons: processedLessons || [],
        progress: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
        },
        core4: {
          today: core4Today || { body: false, being: false, balance: false, business: false },
          streak: core4Streak,
        },
        sunday_modules: processedSundayModules,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get staff challenge error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch challenge data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
