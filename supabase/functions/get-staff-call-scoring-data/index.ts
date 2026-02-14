import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

interface StaffSessionRecord {
  staff_user_id: string;
  expires_at: string;
  staff_users: {
    id: string;
    agency_id: string;
    team_member_id: string | null;
    is_active: boolean;
  } | null;
}

interface SessionRoleRecord {
  role: string | null;
}

interface TeamMemberRecord {
  id: string;
  name: string;
}

interface TemplateRecord {
  id: string;
  name: string;
  call_type: string | null;
}

interface CallListRow {
  id: string;
  team_member_id: string | null;
  template_id: string | null;
  original_filename: string | null;
  status: string | null;
  overall_score: number | null;
  potential_rank: string | null;
  summary: string | null;
  created_at: string;
  analyzed_at: string | null;
  call_type: string | null;
  call_duration_seconds: number | null;
  agent_talk_percent: number | null;
  customer_talk_percent: number | null;
  dead_air_percent: number | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  staff_feedback_positive: string | null;
  staff_feedback_improvement: string | null;
  skill_scores: unknown;
  section_scores: unknown;
  client_profile: unknown;
  discovery_wins: unknown;
  critical_gaps: unknown;
  closing_attempts: unknown;
  missed_signals: unknown;
  coaching_recommendations: unknown;
  notable_quotes: unknown;
  premium_analysis: unknown;
  agent_talk_seconds: number | null;
  customer_talk_seconds: number | null;
  dead_air_seconds: number | null;
}

interface AnalyticsCallRow {
  id: string;
  team_member_id: string;
  template_id: string | null;
  potential_rank: string | null;
  overall_score: number | null;
  skill_scores: unknown;
  discovery_wins: unknown;
  analyzed_at: string | null;
  analyzed_or_created_at?: string | null;
}

function getAnalyzedAtValue(row: { analyzed_at?: string | null; analyzed_or_created_at?: string | null; created_at?: string | null }): string | null {
  return row.analyzed_at || row.analyzed_or_created_at || row.created_at || null;
}

/**
 * Staff Call Scoring Data Edge Function
 *
 * This function enforces role-based access control:
 * - Staff users can only view their own call scores (filtered by team_member_id)
 * - Manager role users can view all call scores for their agency
 *
 * Session validation ensures staff users cannot manipulate parameters to see
 * other team members' data.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get session token from header
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      console.log('[get-staff-call-scoring-data] No session token provided');
      return new Response(
        JSON.stringify({ error: 'No session token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session and get staff user with is_active check
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        staff_user_id,
        expires_at,
        staff_users (
          id,
          agency_id,
          team_member_id,
          is_active
        )
      `)
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single() as { data: StaffSessionRecord | null; error: unknown };

    if (sessionError || !session) {
      console.log('[get-staff-call-scoring-data] Invalid or expired session');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff user is active
    if (!session.staff_users?.is_active) {
      console.log('[get-staff-call-scoring-data] Staff user is not active');
      return new Response(
        JSON.stringify({ error: 'User account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agencyId = session.staff_users.agency_id;
    const staffTeamMemberId = session.staff_users.team_member_id;

    // SECURITY: Staff must have a team_member_id to access call scoring
    // Without it, we can't determine their role or filter their calls
    if (!staffTeamMemberId) {
      console.log('[get-staff-call-scoring-data] Staff user not linked to team member');
      return new Response(
        JSON.stringify({ error: 'Staff account not linked to team member', recent_calls: [], total_calls: 0, team_members: [], templates: [], usage: { calls_used: 0, calls_limit: 20 }, analytics_calls: [], is_manager: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the team member's role to determine access level
    let isManager = false;
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('id', staffTeamMemberId)
      .single() as { data: SessionRoleRecord | null; error: unknown };

    const normalizedRole = (teamMember?.role || '').toLowerCase();
    if (normalizedRole === 'manager' || normalizedRole === 'owner') {
      isManager = true;
    }

    const { data: callScoringQaAccess } = await supabase
      .from('agency_feature_access')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('feature_key', 'call_scoring_qa')
      .maybeSingle();

    // Get request body for pagination
    const body = await req.json().catch(() => ({}));
    const { page = 1, pageSize = 10 } = body;
    const offset = (page - 1) * pageSize;

    // SECURITY: Enforce role-based access
    // - Managers (isManager = true): can see all agency calls (teamMemberFilter = null)
    // - Staff (isManager = false): can only see their own calls (teamMemberFilter = their ID)
    const teamMemberFilter = isManager ? null : staffTeamMemberId;

    console.log(`[get-staff-call-scoring-data] Agency: ${agencyId}, TeamMember: ${staffTeamMemberId}, IsManager: ${isManager}, Filter: ${teamMemberFilter}`);

    // Get total count
    let countQuery = supabase
      .from('agency_calls')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    if (teamMemberFilter) {
      countQuery = countQuery.eq('team_member_id', teamMemberFilter);
    }

    const { count: totalCalls } = await countQuery;

    // Get recent calls (schema-safe)
    let callsQuery = supabase
      .from('agency_calls')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (teamMemberFilter) {
      callsQuery = callsQuery.eq('team_member_id', teamMemberFilter);
    }

    const { data: calls, error: callsError } = await callsQuery;

    if (callsError) {
      console.error('[get-staff-call-scoring-data] Calls query error:', callsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch calls' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get team member names for the calls
    const callRows = ((calls || []) as unknown as Array<Record<string, string | number | null | boolean>>).map((call) => ({
      ...(call as unknown as CallListRow),
      analyzed_at: getAnalyzedAtValue({
        ...(call as { analyzed_at?: string | null; analyzed_or_created_at?: string | null; created_at: string }),
      }),
    }));
    const teamMemberIds = [...new Set(callRows
      .map((c) => c.team_member_id)
      .filter((id): id is string => !!id))];
    const templateIds = [...new Set(callRows
      .map((c) => c.template_id)
      .filter((id): id is string => !!id))];

    let teamMemberMap: Record<string, string> = {};
    let templateMap: Record<string, { name: string; call_type: string | null }> = {};

    if (teamMemberIds.length > 0) {
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, name')
        .in('id', teamMemberIds);

      const rows = (teamMembers || []) as TeamMemberRecord[];
      teamMemberMap = rows.reduce((acc: Record<string, string>, tm: TeamMemberRecord) => {
        acc[tm.id] = tm.name;
        return acc;
      }, {});
    }

    if (templateIds.length > 0) {
      const { data: templates } = await supabase
        .from('call_scoring_templates')
        .select('id, name, call_type')
        .in('id', templateIds);

      const templateRows = (templates || []) as TemplateRecord[];
      templateMap = templateRows.reduce((acc: Record<string, { name: string; call_type: string | null }>, t: TemplateRecord) => {
        acc[t.id] = { name: t.name, call_type: t.call_type };
        return acc;
      }, {});
    }

    // Enrich calls with team member and template names
    const recentCalls = callRows.map((call: CallListRow) => ({
      ...call,
      team_member_name: call.team_member_id && teamMemberMap[call.team_member_id] ? teamMemberMap[call.team_member_id] : 'Unknown',
      template_name: call.template_id && templateMap[call.template_id]?.name ? templateMap[call.template_id]?.name : 'Unknown Template',
    }));

    // Get team members for dropdown (staff sees only themselves, managers see all)
    let teamMembersQuery = supabase
      .from('team_members')
      .select('id, name, role')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .order('name');

    if (teamMemberFilter) {
      teamMembersQuery = teamMembersQuery.eq('id', teamMemberFilter);
    }

    const { data: teamMembers } = await teamMembersQuery;

    // Get active templates (agency-specific and global)
    const { data: templates } = await supabase
      .from('call_scoring_templates')
      .select('id, name, description, call_type')
      .or(`agency_id.eq.${agencyId},is_global.eq.true`)
      .eq('is_active', true)
      .order('name');

    // Get usage info - fetch settings and usage tracking separately
    // (no foreign key relationship between these tables)
    const { data: settingsData } = await supabase
      .from('agency_call_scoring_settings')
      .select('calls_limit')
      .eq('agency_id', agencyId)
      .maybeSingle(); // Use maybeSingle in case settings don't exist yet

    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabase
      .from('call_usage_tracking')
      .select('calls_used')
      .eq('agency_id', agencyId)
      .lte('period_start', today)
      .gte('period_end', today)
      .maybeSingle(); // Use maybeSingle to avoid error when no record exists

    const usage = {
      calls_used: usageData?.calls_used || 0,
      calls_limit: settingsData?.calls_limit || 20,
    };

    // Get analytics calls for managers only
    let analyticsCalls: Array<{
      id: string;
      team_member_id: string;
      team_member_name: string;
      template_id: string | null;
      template_name: string;
      potential_rank: string | null;
      overall_score: number | null;
      skill_scores: unknown;
      discovery_wins: unknown;
      analyzed_at: string | null;
    }> = [];
    if (isManager) {
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('agency_calls')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (analyticsError) {
        console.error('[get-staff-call-scoring-data] Analytics calls query error:', analyticsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch analytics calls' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build maps for analytics calls that might not be in recent calls
      const analyticsRows = ((analyticsData || []) as unknown as Array<Record<string, string | number | null | boolean>>).map((call) => ({
        ...(call as unknown as AnalyticsCallRow),
        analyzed_at: getAnalyzedAtValue({
          ...(call as { analyzed_at?: string | null; analyzed_or_created_at?: string | null; created_at: string }),
        }) || null,
      }));
      const analyticsTeamMemberIds = [...new Set(analyticsRows
        .map((c) => c.team_member_id)
        .filter((id): id is string => !!id))];
      const analyticsTemplateIds = [...new Set(analyticsRows
        .map((c) => c.template_id)
        .filter((id): id is string => !!id))];

      // Fetch any team members not already in our map
      const missingTeamMemberIds = analyticsTeamMemberIds.filter(id => !teamMemberMap[id]);
      if (missingTeamMemberIds.length > 0) {
        const { data: missingTeamMembers } = await supabase
          .from('team_members')
          .select('id, name')
          .in('id', missingTeamMemberIds);

        const rows = (missingTeamMembers || []) as TeamMemberRecord[];
        rows.forEach((tm: TeamMemberRecord) => {
          teamMemberMap[tm.id] = tm.name;
        });
      }

      // Fetch any templates not already in our map
      const missingTemplateIds = analyticsTemplateIds.filter(id => !templateMap[id]);
      if (missingTemplateIds.length > 0) {
        const { data: missingTemplates } = await supabase
          .from('call_scoring_templates')
          .select('id, name, call_type')
          .in('id', missingTemplateIds);

        const templateRows = (missingTemplates || []) as TemplateRecord[];
        templateRows.forEach((t: TemplateRecord) => {
          templateMap[t.id] = { name: t.name, call_type: t.call_type };
        });
      }

      analyticsCalls = analyticsRows.map((call: AnalyticsCallRow) => ({
        ...call,
        team_member_name: call.team_member_id && teamMemberMap[call.team_member_id] ? teamMemberMap[call.team_member_id] : 'Unknown',
        template_name: call.template_id && templateMap[call.template_id]?.name ? templateMap[call.template_id]?.name : 'Unknown Template',
      }));
    }

    const result = {
      recent_calls: recentCalls,
      total_calls: totalCalls || 0,
      team_members: teamMembers || [],
      templates: templates || [],
      usage,
      analytics_calls: analyticsCalls,
      is_manager: isManager,
      has_call_scoring_qa: Boolean(callScoringQaAccess),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-staff-call-scoring-data] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
