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
          team_member_id,
          team_members (
            id,
            name,
            role
          )
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
    const teamMember = staffUser?.team_members;
    const agencyId = staffUser?.agency_id;

    // Check if user is a manager
    if (teamMember?.role !== 'Manager') {
      return new Response(
        JSON.stringify({ error: 'Manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type } = await req.json();
    console.log('Request type:', type, 'Agency:', agencyId);

    let responseData: any = {};

    switch (type) {
      case 'team_members': {
        // Fetch all team members for the agency
        const { data: members, error } = await supabase
          .from('team_members')
          .select('id, name, email, phone, role, status')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .order('name');

        if (error) {
          console.error('Error fetching team members:', error);
          throw error;
        }

        responseData = { team_members: members || [] };
        break;
      }

      case 'performance': {
        // Fetch recent metrics for all team members in the agency (last 7 days)
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

        responseData = { metrics: enrichedMetrics };
        break;
      }

      case 'roleplay': {
        // Fetch roleplay sessions for all team members in the agency
        const { data: sessions, error: sessionsError } = await supabase
          .from('roleplay_sessions')
          .select(`
            id,
            staff_name,
            overall_score,
            completed_at,
            pdf_file_path,
            roleplay_tokens (
              team_member_id
            )
          `)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(50);

        if (sessionsError) {
          console.error('Error fetching roleplay sessions:', sessionsError);
          throw sessionsError;
        }

        // Filter to only sessions from team members in this agency
        const { data: agencyMembers } = await supabase
          .from('team_members')
          .select('id')
          .eq('agency_id', agencyId);

        const agencyMemberIds = new Set(agencyMembers?.map(m => m.id) || []);

        const filteredSessions = (sessions || []).filter(s => {
          const token = s.roleplay_tokens as any;
          return token?.team_member_id && agencyMemberIds.has(token.team_member_id);
        });

        responseData = { sessions: filteredSessions };
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
