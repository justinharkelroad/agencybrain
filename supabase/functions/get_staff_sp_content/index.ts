import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, category_slug, module_slug, lesson_slug } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', session_token)
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;

    // Check if staff user has Manager or Owner role via team_member link
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('team_member_id, team_members(role)')
      .eq('id', staffUserId)
      .single();

    const staffRole = (staffUser?.team_members as any)?.role;
    const isManager = staffRole === 'Manager' || staffRole === 'Owner';
    console.log(`Staff user ${staffUserId} role: ${staffRole}, isManager: ${isManager}`);

    // Helper to check if category is accessible based on role
    const canAccessCategory = (accessTiers: string[]) => {
      if (!accessTiers) return false;
      if (accessTiers.includes('staff')) return true;
      if (isManager && accessTiers.includes('manager')) return true;
      return false;
    };

    // If requesting a specific lesson
    if (lesson_slug) {
      console.log('Fetching specific lesson:', lesson_slug);

      const { data: lessonData, error: lessonError } = await supabase
        .from('sp_lessons')
        .select(`
          *,
          module:sp_modules(
            id, name, slug,
            category:sp_categories(id, name, slug, access_tiers)
          )
        `)
        .eq('slug', lesson_slug)
        .eq('is_published', true)
        .single();

      if (lessonError) {
        console.error('Lesson fetch error:', lessonError);
        return new Response(
          JSON.stringify({ error: 'Lesson not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify access to this lesson's category
      const categoryAccessTiers = (lessonData.module as any)?.category?.access_tiers || [];
      if (!canAccessCategory(categoryAccessTiers)) {
        console.log('Access denied to lesson - category access_tiers:', categoryAccessTiers);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch quiz if has_quiz
      let quizData = null;
      if (lessonData.has_quiz) {
        const { data: quiz } = await supabase
          .from('sp_quizzes')
          .select('*')
          .eq('lesson_id', lessonData.id)
          .single();
        quizData = quiz;
      }

      // Check if completed
      const { data: progressData } = await supabase
        .from('sp_progress_staff')
        .select('quiz_passed')
        .eq('staff_user_id', staffUserId)
        .eq('lesson_id', lessonData.id)
        .single();

      // Find next lesson
      const { data: lessonsInModule } = await supabase
        .from('sp_lessons')
        .select('slug, name, display_order')
        .eq('module_id', lessonData.module_id)
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      let nextLesson = null;
      if (lessonsInModule) {
        const currentIndex = lessonsInModule.findIndex(l => l.slug === lesson_slug);
        if (currentIndex >= 0 && currentIndex < lessonsInModule.length - 1) {
          nextLesson = lessonsInModule[currentIndex + 1];
        }
      }

      return new Response(
        JSON.stringify({
          lesson: lessonData,
          quiz: quizData,
          completed: progressData?.quiz_passed || false,
          nextLesson,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If requesting a specific category
    if (category_slug) {
      console.log('Fetching specific category:', category_slug);

      // Fetch category and check access based on role
      const { data: catData, error: catError } = await supabase
        .from('sp_categories')
        .select('*')
        .eq('slug', category_slug)
        .eq('is_published', true)
        .single();

      if (catError) {
        console.error('Category fetch error:', catError);
        return new Response(
          JSON.stringify({ error: 'Category not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify access to this category
      if (!canAccessCategory(catData.access_tiers)) {
        console.log('Access denied to category - access_tiers:', catData.access_tiers);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch modules with lessons
      const { data: modData, error: modError } = await supabase
        .from('sp_modules')
        .select(`
          *,
          sp_lessons(*)
        `)
        .eq('category_id', catData.id)
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      if (modError) {
        console.error('Modules fetch error:', modError);
      }

      // Fetch staff progress
      const { data: progressData } = await supabase
        .from('sp_progress_staff')
        .select('lesson_id')
        .eq('staff_user_id', staffUserId)
        .eq('quiz_passed', true);

      const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

      // Build modules with completion status
      const modulesWithProgress = (modData || []).map(mod => ({
        ...mod,
        lessons: (mod.sp_lessons || [])
          .filter((l: any) => l.is_published)
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((lesson: any) => ({
            ...lesson,
            completed: completedLessonIds.has(lesson.id),
          })),
      }));

      return new Response(
        JSON.stringify({
          category: catData,
          modules: modulesWithProgress,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: fetch all categories for training hub
    console.log('Fetching all SP categories for staff, isManager:', isManager);

    // Fetch all published categories, then filter by role-based access
    const { data: allCatData, error: catError } = await supabase
      .from('sp_categories')
      .select(`
        *,
        sp_modules(
          id,
          sp_lessons(id)
        )
      `)
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (catError) {
      console.error('Categories fetch error:', catError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch categories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter categories based on role
    const catData = (allCatData || []).filter(cat => canAccessCategory(cat.access_tiers));

    // Get staff's progress
    const { data: progressData, error: progressError } = await supabase
      .from('sp_progress_staff')
      .select('lesson_id, completed_at')
      .eq('staff_user_id', staffUserId)
      .eq('quiz_passed', true);

    if (progressError) {
      console.error('Progress fetch error:', progressError);
    }

    const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

    // Calculate category stats
    const categoriesWithStats = (catData || []).map(cat => {
      let lessonCount = 0;
      let completedCount = 0;

      cat.sp_modules?.forEach((mod: any) => {
        mod.sp_lessons?.forEach((lesson: any) => {
          lessonCount++;
          if (completedLessonIds.has(lesson.id)) {
            completedCount++;
          }
        });
      });

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        color: cat.color || '#1e283a',
        image_url: cat.image_url || null,
        module_count: cat.sp_modules?.length || 0,
        lesson_count: lessonCount,
        completed_count: completedCount,
      };
    });

    // Calculate overall stats
    const totalLessons = categoriesWithStats.reduce((sum, c) => sum + c.lesson_count, 0);
    const completedLessons = categoriesWithStats.reduce((sum, c) => sum + c.completed_count, 0);

    // Calculate streak
    const completionDates = progressData
      ?.filter(p => p.completed_at)
      .map(p => new Date(p.completed_at).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    if (completionDates && completionDates.length > 0) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (completionDates[0] === today || completionDates[0] === yesterday) {
        streak = 1;
        let checkDate = new Date(completionDates[0]);

        for (let i = 1; i < completionDates.length; i++) {
          checkDate = new Date(checkDate.getTime() - 86400000);
          if (completionDates[i] === checkDate.toDateString()) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        categories: categoriesWithStats,
        stats: {
          totalLessons,
          completedLessons,
          currentStreak: streak,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error in get_staff_sp_content:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
