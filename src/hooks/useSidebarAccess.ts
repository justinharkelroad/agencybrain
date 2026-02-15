import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  NavEntry,
  NavItem,
  NavFolder,
  NavSubFolder,
  AccessConfig,
  isNavFolder,
  isNavSubFolder
} from '@/config/navigation';
import { hasSalesAccess } from '@/lib/salesBetaAccess';

export interface UserAccess {
  isStaff: boolean;
  isManager: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

export interface SidebarFilterOptions {
  callScoringEnabled: boolean;
  userEmail?: string;
  hasSalesExperienceAccess?: boolean;
  hasSalesProcessBuilderAccess?: boolean;
  hasCoachingInsightsAccess?: boolean;
  hasCallGapsAccess?: boolean;
}

export function useSidebarAccess() {
  const { isAdmin, isAgencyOwner, isKeyEmployee, hasTierAccess, roleLoading } = useAuth();
  const { effectiveRole, loading: permissionsLoading, agencyId } = useUserPermissions();

  // Combine auth role loading with permissions loading
  const combinedLoading = roleLoading || permissionsLoading;

  const userAccess = useMemo<UserAccess>(() => {
    const isOwner = isAdmin || isAgencyOwner;
    const isManager = isKeyEmployee || effectiveRole === 'manager';
    const isStaffLevel = effectiveRole === 'staff';

    return {
      isStaff: isStaffLevel,
      isManager: isManager || isOwner, // Managers and above
      isOwner: isOwner,
      isAdmin: isAdmin,
    };
  }, [isAdmin, isAgencyOwner, isKeyEmployee, effectiveRole]);

  const canAccess = useMemo(() => {
    return (access: AccessConfig): boolean => {
      // Check from highest to lowest privilege
      if (userAccess.isOwner) return access.owner;
      if (userAccess.isManager) return access.manager;
      return access.staff;
    };
  }, [userAccess]);

  const checkItemAccess = useMemo(() => {
    return (item: NavItem, options: SidebarFilterOptions): boolean => {
      const { callScoringEnabled, userEmail, hasSalesExperienceAccess, hasSalesProcessBuilderAccess, hasCoachingInsightsAccess, hasCallGapsAccess } = options;

      // Check email restriction first - most restrictive
      if (item.emailRestriction) {
        if (!userEmail || userEmail.toLowerCase() !== item.emailRestriction.toLowerCase()) {
          return false;
        }
      }

      // Check adminOnly flag - system admins and beta agencies can see these items
      if (item.adminOnly && !userAccess.isAdmin && !hasSalesAccess(agencyId)) {
        return false;
      }

      // NOTE: challengeAccess items are NOT filtered here - they're shown to everyone
      // and gated at click-time with a "Coming Soon" modal for non-whitelisted agencies

      // Check salesExperienceAccess - only show if user has active assignment
      if (item.salesExperienceAccess && !hasSalesExperienceAccess) {
        return false;
      }

      // Check salesProcessBuilderAccess - only show if agency has feature flag
      if (item.salesProcessBuilderAccess && !hasSalesProcessBuilderAccess) {
        return false;
      }

      // Check coachingInsightsAccess - only show if agency is in beta list
      if (item.coachingInsightsAccess && !hasCoachingInsightsAccess) {
        return false;
      }

      // Check callGapsAccess - only show if agency has feature flag
      if (item.callGapsAccess && !hasCallGapsAccess) {
        return false;
      }

      // First check base access
      if (!canAccess(item.access)) return false;

      // Check feature tier if specified
      if (item.featureCheck && !hasTierAccess(item.featureCheck)) {
        return false;
      }

      // Check setting-based access (e.g., call scoring)
      if (item.settingCheck === 'callScoringEnabled' && !callScoringEnabled) {
        return false;
      }

      return true;
    };
  }, [canAccess, hasTierAccess, userAccess.isAdmin, agencyId]);

  const filterNavigation = useMemo(() => {
    return (config: NavEntry[], options: SidebarFilterOptions): NavEntry[] => {
      return config
        .filter((entry) => {
          if (isNavFolder(entry)) {
            // Check folder-level access first
            if (!canAccess(entry.access)) return false;
            // Check salesExperienceAccess on folder level
            if (entry.salesExperienceAccess && !options.hasSalesExperienceAccess) {
              return false;
            }
            return true;
          }
          // Check individual item access
          return checkItemAccess(entry, options);
        })
        .map((entry) => {
          if (isNavFolder(entry)) {
            // Filter items within the folder (including sub-folders)
            const filteredItems = entry.items
              .filter((item) => {
                if (isNavSubFolder(item)) {
                  // Check sub-folder access
                  return canAccess(item.access);
                }
                return checkItemAccess(item, options);
              })
              .map((item) => {
                if (isNavSubFolder(item)) {
                  // Filter items within sub-folder
                  const filteredSubItems = item.items.filter((subItem) =>
                    checkItemAccess(subItem, options)
                  );
                  return { ...item, items: filteredSubItems };
                }
                return item;
              })
              .filter((item) => {
                // Remove empty sub-folders
                if (isNavSubFolder(item)) {
                  return item.items.length > 0;
                }
                return true;
              });
            // Return folder with filtered items (or exclude if empty)
            return { ...entry, items: filteredItems };
          }
          return entry;
        })
        .filter((entry) => {
          // Remove empty folders
          if (isNavFolder(entry)) {
            return entry.items.length > 0;
          }
          return true;
        });
    };
  }, [canAccess, checkItemAccess]);

  return {
    userAccess,
    canAccess,
    checkItemAccess,
    filterNavigation,
    loading: combinedLoading,
    agencyId,
  };
}
