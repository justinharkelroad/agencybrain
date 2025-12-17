import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify staff session
    const staffSessionToken = req.headers.get('x-staff-session');
    if (!staffSessionToken) {
      return new Response(
        JSON.stringify({ error: 'Staff session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the session and get user data
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        id,
        staff_user_id,
        expires_at,
        staff_users (
          id,
          username,
          agency_id,
          team_member_id
        )
      `)
      .eq('session_token', staffSessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUser = session.staff_users as any;
    const agencyId = staffUser?.agency_id;
    const teamMemberId = staffUser?.team_member_id;

    // Get the team member's role from team_members table
    let isManager = false;
    if (teamMemberId) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('id', teamMemberId)
        .single();
      
      isManager = teamMember?.role === 'Manager';
    }

    const { type } = await req.json();
    console.log('Request type:', type, 'Agency:', agencyId, 'isManager:', isManager);

    let responseData: any = {};

    switch (type) {
      case 'focus_items': {
        // Focus items - available to ALL staff users
        // Get focus items for the agency
        const { data: focusItems, error } = await supabase
          .from('focus_items')
          .select('id, title, description, priority_level, column_status, created_at, completed_at, column_order')
          .eq('agency_id', agencyId)
          .order('column_order', { ascending: true });

        if (error) {
          console.error('Error fetching focus items:', error);
          throw error;
        }

        responseData = { focus_items: focusItems || [] };
        break;
      }

      case 'team_members': {
        // Manager-only: Fetch all team members for the agency
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: members, error } = await supabase
          .from('team_members')
          .select('id, name, email, role, status')
          .eq('agency_id', agencyId)
          .order('name');

        if (error) {
          console.error('Error fetching team members:', error);
          throw error;
        }

        responseData = { team_members: members || [] };
        break;
      }

      case 'performance': {
        // Manager-only: Fetch recent metrics for all team members in the agency (last 7 days)
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: metrics, error: metricsError } = await supabase
          .from('metrics_daily')
          .select('team_member_id, date, hits, pass, sold_items, quoted_count, talk_minutes')
          .eq('agency_id', agencyId)
          .gte('date', sevenDaysAgo.toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (metricsError) {
          console.error('Error fetching metrics:', metricsError);
          throw metricsError;
        }

        // Get team member names
        const memberIds = [...new Set(metrics?.map(m => m.team_member_id) || [])];
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']);

        const memberMap = new Map(members?.map(m => [m.id, m.name]) || []);

        const enrichedMetrics = (metrics || []).map(m => ({
          ...m,
          team_member_name: memberMap.get(m.team_member_id) || 'Unknown'
        }));

        responseData = { performance: enrichedMetrics };
        break;
      }

      case 'roleplay': {
        // Manager-only: Fetch roleplay sessions for the agency
        if (!isManager) {
          return new Response(
            JSON.stringify({ error: 'Manager access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: sessions, error: sessionsError } = await supabase
          .from('roleplay_sessions')
          .select('id, staff_name, staff_email, overall_score, completed_at, pdf_file_path')
          .eq('agency_id', agencyId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(20);

        if (sessionsError) {
          console.error('Error fetching roleplay sessions:', sessionsError);
          throw sessionsError;
        }

        responseData = { roleplay_sessions: sessions || [] };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid request type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_team_data:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
