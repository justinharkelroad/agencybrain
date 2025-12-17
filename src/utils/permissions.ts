// Role types for permission system
export type TeamMemberRole = 'Sales' | 'Service' | 'Hybrid' | 'Manager';
export type EffectiveRole = 'admin' | 'owner' | 'manager' | 'staff';

export interface AgencySettings {
  staff_can_upload_calls: boolean;
}

// Permission helper functions
export const permissions = {
  // Dashboard sections - owner only
  canViewPerformanceMetrics: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canViewMonthOverMonthTrends: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canViewSharedInsights: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canViewReportingPeriods: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canSubmitCoachingCall: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canSubmitMetrics: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  
  // Team management
  canEditTeamMembers: (role: EffectiveRole) => role === 'admin' || role === 'owner',
  canViewTeamMembers: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  
  // Features available to managers and owners
  canViewFocusTargets: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewRoleplaySessions: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewMetricsDashboard: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewStaffMetrics: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewCallScoring: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewROITools: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewReports: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewExplorer: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  canViewTraining: (role: EffectiveRole) => true, // All roles
  canViewMyAgency: (role: EffectiveRole) => ['admin', 'owner', 'manager'].includes(role),
  
  // Call recording - special handling based on agency settings
  canUploadCallRecordings: (role: EffectiveRole, agencySettings?: AgencySettings | null) => {
    // Admins, owners, and managers can always upload
    if (role === 'admin' || role === 'owner' || role === 'manager') return true;
    // Staff depends on agency setting (defaults to true)
    return agencySettings?.staff_can_upload_calls ?? true;
  },
};

// Helper to determine effective role from team member role
export function getEffectiveRoleFromTeamMember(teamMemberRole: TeamMemberRole | null | undefined): EffectiveRole {
  if (!teamMemberRole) return 'staff';
  if (teamMemberRole === 'Manager') return 'manager';
  return 'staff'; // Sales, Service, Hybrid are all "staff" level
}
