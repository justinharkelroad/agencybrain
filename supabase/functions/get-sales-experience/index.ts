import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ModuleWithLessons {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  pillar: string;
  icon: string | null;
  lessons: LessonWithProgress[];
}

interface LessonWithProgress {
  id: string;
  module_id: string;
  day_of_week: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  is_staff_visible: boolean;
  progress: {
    status: string;
    started_at: string | null;
    completed_at: string | null;
    video_watched_seconds: number;
    video_completed: boolean;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service client for data queries (RLS will be handled in our logic)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's profile to find their agency
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin, agency owner (has agency_id), or key employee
    const isAdmin = profile.role === 'admin';
    let isOwnerOrManager = !!profile.agency_id;

    if (!isOwnerOrManager) {
      // Check key_employees table
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyEmployee?.agency_id) {
        isOwnerOrManager = true;
        profile.agency_id = keyEmployee.agency_id;
      }
    }

    if (!isAdmin && !isOwnerOrManager) {
      return new Response(
        JSON.stringify({ error: 'Access denied', has_access: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active/pending assignment for user's agency
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('*')
      .eq('agency_id', profile.agency_id)
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

    // No assignment found
    if (!assignment) {
      return new Response(
        JSON.stringify({
          has_access: false,
          assignment: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current week
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
    const dayInWeek = ((businessDays - 1) % 5) + 1; // 1-5 within the week

    // Get all modules
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

    // Get all lessons
    const { data: lessons, error: lessonsError } = await supabase
      .from('sales_experience_lessons')
      .select('*')
      .order('day_of_week');

    if (lessonsError) {
      console.error('Lessons error:', lessonsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch lessons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner's progress
    const { data: progressRecords, error: progressError } = await supabase
      .from('sales_experience_owner_progress')
      .select('*')
      .eq('assignment_id', assignment.id)
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Progress error:', progressError);
    }

    // Create a map of lesson progress
    const progressMap = new Map<string, any>();
    (progressRecords || []).forEach((p) => {
      progressMap.set(p.lesson_id, p);
    });

    // Group lessons by module and add progress
    const moduleMap = new Map<string, ModuleWithLessons>();
    modules?.forEach((m) => {
      moduleMap.set(m.id, {
        ...m,
        lessons: [],
      });
    });

    lessons?.forEach((lesson) => {
      const module = moduleMap.get(lesson.module_id);
      if (module) {
        const progress = progressMap.get(lesson.id);
        const moduleWeek = module.week_number;

        // Determine if lesson is unlocked (owner has immediate access to all lessons up to current week)
        const isUnlocked =
          assignment.status === 'active' &&
          (moduleWeek < currentWeek ||
            (moduleWeek === currentWeek && lesson.day_of_week <= dayInWeek));

        module.lessons.push({
          ...lesson,
          progress: progress
            ? {
                status: progress.status,
                started_at: progress.started_at,
                completed_at: progress.completed_at,
                video_watched_seconds: progress.video_watched_seconds,
                video_completed: progress.video_completed,
              }
            : null,
          is_unlocked: isUnlocked,
        });
      }
    });

    // Convert map to array
    const modulesWithLessons = Array.from(moduleMap.values()).sort(
      (a, b) => a.week_number - b.week_number
    );

    // Calculate progress statistics
    const totalLessons = lessons?.length || 0;
    const completedLessons =
      progressRecords?.filter((p) => p.status === 'completed').length || 0;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Get unread messages count
    const { count: unreadMessages } = await supabase
      .from('sales_experience_messages')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignment.id)
      .eq('sender_type', 'coach')
      .is('read_at', null);

    // Get transcript for current week (if any)
    const { data: transcript } = await supabase
      .from('sales_experience_transcripts')
      .select('*')
      .eq('assignment_id', assignment.id)
      .eq('week_number', currentWeek)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        has_access: true,
        assignment: {
          id: assignment.id,
          status: assignment.status,
          start_date: assignment.start_date,
          end_date: assignment.end_date,
          timezone: assignment.timezone,
        },
        current_week: currentWeek,
        current_business_day: businessDays,
        day_in_week: dayInWeek,
        modules: modulesWithLessons,
        progress: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
        },
        unread_messages: unreadMessages || 0,
        current_week_transcript: transcript || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get sales experience error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch sales experience data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
