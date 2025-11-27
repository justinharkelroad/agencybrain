import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, agency_id } = await req.json();

    if (!session_token || !agency_id) {
      return new Response(
        JSON.stringify({ error: 'Session token and agency_id required' }),
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

    // Verify staff belongs to requested agency
    if (session.staff_users.agency_id !== agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch training modules
    const { data: modules, error: modulesError } = await supabase
      .from('training_modules')
      .select('*')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .order('order_index');

    if (modulesError) {
      console.error('Error fetching modules:', modulesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch modules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('training_categories')
      .select('*')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .order('order_index');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
    }

    // Fetch lessons for all modules
    const { data: lessons, error: lessonsError } = await supabase
      .from('training_lessons')
      .select('*')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .order('order_index');

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
    }

    // Fetch attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('training_attachments')
      .select('*')
      .eq('agency_id', agency_id)
      .order('created_at');

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
    }

    return new Response(
      JSON.stringify({
        modules: modules || [],
        categories: categories || [],
        lessons: lessons || [],
        attachments: attachments || [],
        staff_user: {
          id: session.staff_users.id,
          username: session.staff_users.username,
          display_name: session.staff_users.display_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_training_content:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
