import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { permissions, EffectiveRole, AgencySettings, getEffectiveRoleFromTeamMember, TeamMemberRole } from '@/utils/permissions';

interface UserPermissionsState {
  effectiveRole: EffectiveRole;
  agencySettings: AgencySettings | null;
  loading: boolean;
  teamMemberRole: TeamMemberRole | null;
  agencyId: string | null;
}

export function useUserPermissions() {
  const { user, isAdmin, isAgencyOwner } = useAuth();
  const [state, setState] = useState<UserPermissionsState>({
    effectiveRole: 'staff',
    agencySettings: null,
    loading: true,
    teamMemberRole: null,
    agencyId: null,
  });

  const fetchPermissionData = useCallback(async () => {
    if (!user?.id) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // If admin, just return admin role
      if (isAdmin) {
        setState({
          effectiveRole: 'admin',
          agencySettings: { staff_can_upload_calls: true },
          loading: false,
          teamMemberRole: null,
          agencyId: null,
        });
        return;
      }

      // Get profile with agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.agency_id) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch agency settings
      const { data: agency } = await supabase
        .from('agencies')
        .select('staff_can_upload_calls')
        .eq('id', profile.agency_id)
        .maybeSingle();

      const agencySettings: AgencySettings = {
        staff_can_upload_calls: agency?.staff_can_upload_calls ?? true,
      };

      // If agency owner (determined by having agency_id in profile), they're an "owner"
      if (isAgencyOwner) {
        setState({
          effectiveRole: 'owner',
          agencySettings,
          loading: false,
          teamMemberRole: null,
          agencyId: profile.agency_id,
        });
        return;
      }

      // Otherwise, check if user has a linked team member via staff_users
      const { data: staffUser } = await supabase
        .from('staff_users')
        .select('team_member_id')
        .eq('agency_id', profile.agency_id)
        .maybeSingle();

      if (staffUser?.team_member_id) {
        // Get team member role
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('role')
          .eq('id', staffUser.team_member_id)
          .maybeSingle();

        const teamMemberRole = teamMember?.role as TeamMemberRole | null;
        const effectiveRole = getEffectiveRoleFromTeamMember(teamMemberRole);

        setState({
          effectiveRole,
          agencySettings,
          loading: false,
          teamMemberRole,
          agencyId: profile.agency_id,
        });
      } else {
        // User with agency but no team member link - treat as owner
        setState({
          effectiveRole: 'owner',
          agencySettings,
          loading: false,
          teamMemberRole: null,
          agencyId: profile.agency_id,
        });
      }
    } catch (error) {
      console.error('Error fetching permission data:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, isAdmin, isAgencyOwner]);

  useEffect(() => {
    fetchPermissionData();
  }, [fetchPermissionData]);

  // Return permissions helper with current role and settings
  return {
    ...state,
    permissions,
    // Convenience methods
    canViewPerformanceMetrics: permissions.canViewPerformanceMetrics(state.effectiveRole),
    canViewMonthOverMonthTrends: permissions.canViewMonthOverMonthTrends(state.effectiveRole),
    canViewSharedInsights: permissions.canViewSharedInsights(state.effectiveRole),
    canViewReportingPeriods: permissions.canViewReportingPeriods(state.effectiveRole),
    canSubmitCoachingCall: permissions.canSubmitCoachingCall(state.effectiveRole),
    canSubmitMetrics: permissions.canSubmitMetrics(state.effectiveRole),
    canEditTeamMembers: permissions.canEditTeamMembers(state.effectiveRole),
    canViewTeamMembers: permissions.canViewTeamMembers(state.effectiveRole),
    canViewFocusTargets: permissions.canViewFocusTargets(state.effectiveRole),
    canViewRoleplaySessions: permissions.canViewRoleplaySessions(state.effectiveRole),
    canViewMetricsDashboard: permissions.canViewMetricsDashboard(state.effectiveRole),
    canViewStaffMetrics: permissions.canViewStaffMetrics(state.effectiveRole),
    canViewCallScoring: permissions.canViewCallScoring(state.effectiveRole),
    canViewROITools: permissions.canViewROITools(state.effectiveRole),
    canViewReports: permissions.canViewReports(state.effectiveRole),
    canViewExplorer: permissions.canViewExplorer(state.effectiveRole),
    canViewTraining: permissions.canViewTraining(state.effectiveRole),
    canViewMyAgency: permissions.canViewMyAgency(state.effectiveRole),
    canUploadCallRecordings: permissions.canUploadCallRecordings(state.effectiveRole, state.agencySettings),
    refetch: fetchPermissionData,
  };
}
