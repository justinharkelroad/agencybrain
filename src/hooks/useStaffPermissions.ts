import { useState, useEffect, useMemo } from 'react';
import { useStaffAuth } from './useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { permissions, getEffectiveRoleFromTeamMember, type EffectiveRole, type AgencySettings } from '@/utils/permissions';

export function useStaffPermissions() {
  const { user, loading: authLoading } = useStaffAuth();
  const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Derive effective role from staff user's team member role
  const effectiveRole: EffectiveRole = useMemo(() => {
    if (!user?.role) return 'staff';
    return getEffectiveRoleFromTeamMember(user.role as any);
  }, [user?.role]);

  // Fetch agency settings via RPC to bypass RLS
  useEffect(() => {
    const fetchAgencySettings = async () => {
      if (!user?.agency_id) {
        setSettingsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('get_agency_settings', {
          p_agency_id: user.agency_id
        });

        if (error) {
          console.error('Error fetching agency settings:', error);
          // Default to allowing uploads if we can't fetch settings
          setAgencySettings({ staff_can_upload_calls: true });
        } else {
          setAgencySettings({
            staff_can_upload_calls: data?.staff_can_upload_calls ?? true
          });
        }
      } catch (err) {
        console.error('Error in fetchAgencySettings:', err);
        setAgencySettings({ staff_can_upload_calls: true });
      } finally {
        setSettingsLoading(false);
      }
    };

    if (user?.agency_id) {
      fetchAgencySettings();
    } else {
      setSettingsLoading(false);
    }
  }, [user?.agency_id]);

  const loading = authLoading || settingsLoading;

  // Permission checks using the central permissions utility
  const canViewTeamMembers = permissions.canViewTeamMembers(effectiveRole);
  const canViewStaffMetrics = permissions.canViewStaffMetrics(effectiveRole);
  const canViewCallScoring = permissions.canViewCallScoring(effectiveRole);
  const canViewRoleplaySessions = permissions.canViewRoleplaySessions(effectiveRole);
  const canViewReports = permissions.canViewReports(effectiveRole);
  const canUploadCallRecordings = permissions.canUploadCallRecordings(effectiveRole, agencySettings);

  // Manager-specific check
  const isManager = effectiveRole === 'manager';

  return {
    loading,
    effectiveRole,
    isManager,
    agencySettings,
    // Permission flags
    canViewTeamMembers,
    canViewStaffMetrics,
    canViewCallScoring,
    canViewRoleplaySessions,
    canViewReports,
    canUploadCallRecordings,
  };
}
