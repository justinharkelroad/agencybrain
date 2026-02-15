import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = new URL(req.url);
    const snapshotDate = url.searchParams.get('date') || '';
    const roleFilter = url.searchParams.get('role');
    const teamMemberFilter = url.searchParams.get('teamMemberId');

    if (!snapshotDate || !isValidDate(snapshotDate)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid date. Use YYYY-MM-DD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (roleFilter && !['Sales', 'Service'].includes(roleFilter)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Use Sales or Service.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: snapshot, error: snapshotError } = await supabase
      .from('metrics_daily_snapshots')
      .select('id, version, lock_type, status, snapshot_date')
      .eq('agency_id', authResult.agencyId)
      .eq('snapshot_date', snapshotDate)
      .eq('status', 'locked')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      return new Response(
        JSON.stringify({ error: `Failed to load snapshot: ${snapshotError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!snapshot) {
      const canViewTeam = authResult.mode === 'supabase' || Boolean(authResult.isManager);
      const staffMemberId = authResult.staffMemberId || null;

      return new Response(
        JSON.stringify({
          snapshot: null,
          scope: {
            mode: authResult.mode,
            teamView: canViewTeam,
            roleFilter: roleFilter || null,
            teamMemberFilter: canViewTeam ? (teamMemberFilter || null) : staffMemberId,
          },
          rows: [],
          message: 'No locked snapshot found for this date.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: rows, error: rowsError } = await supabase
      .from('metrics_daily_snapshot_rows')
      .select('team_member_id, role, metric_payload, target_payload, attainment_payload, source_payload, status_payload')
      .eq('snapshot_id', snapshot.id);

    if (rowsError) {
      return new Response(
        JSON.stringify({ error: `Failed to load snapshot rows: ${rowsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const teamMemberIds = [...new Set((rows || []).map(r => r.team_member_id))];
    let teamMembersMap = new Map<string, { name: string; role: string; status: string; include_in_metrics: boolean }>();

    if (teamMemberIds.length > 0) {
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('id, name, role, status, include_in_metrics')
        .in('id', teamMemberIds);

      if (teamError) {
        return new Response(
          JSON.stringify({ error: `Failed to load team members: ${teamError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      for (const tm of teamMembers || []) {
        teamMembersMap.set(tm.id, {
          name: tm.name,
          role: tm.role,
          status: tm.status,
          include_in_metrics: tm.include_in_metrics,
        });
      }
    }

    const canViewTeam = authResult.mode === 'supabase' || Boolean(authResult.isManager);
    const staffMemberId = authResult.staffMemberId || null;

    const filteredRows = (rows || []).filter((row) => {
      const member = teamMembersMap.get(row.team_member_id);
      if (!member) return false;
      if (member.status !== 'active') return false;
      if (!member.include_in_metrics) return false;

      if (!canViewTeam) {
        return Boolean(staffMemberId) && row.team_member_id === staffMemberId;
      }

      if (teamMemberFilter && row.team_member_id !== teamMemberFilter) {
        return false;
      }

      if (roleFilter) {
        return member.role === roleFilter || member.role === 'Hybrid' || member.role === 'Manager';
      }

      return true;
    }).map((row) => {
      const member = teamMembersMap.get(row.team_member_id)!;
      return {
        teamMemberId: row.team_member_id,
        teamMemberName: member.name,
        teamMemberRole: member.role,
        role: row.role,
        metrics: row.metric_payload || {},
        targets: row.target_payload || {},
        attainment: row.attainment_payload || {},
        source: row.source_payload || {},
        status: row.status_payload || {},
      };
    });

    return new Response(
      JSON.stringify({
        snapshot: {
          id: snapshot.id,
          date: snapshot.snapshot_date,
          version: snapshot.version,
          lockType: snapshot.lock_type,
          status: snapshot.status,
        },
        scope: {
          mode: authResult.mode,
          teamView: canViewTeam,
          roleFilter: roleFilter || null,
          teamMemberFilter: canViewTeam ? (teamMemberFilter || null) : staffMemberId,
        },
        rows: filteredRows,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('get_metrics_snapshot error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
