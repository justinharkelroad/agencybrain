import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { 
  NavEntry, 
  NavItem, 
  NavFolder, 
  AccessConfig, 
  isNavFolder 
} from '@/config/navigation';
import { hasSalesBetaAccess } from '@/lib/salesBetaAccess';

export interface UserAccess {
  isStaff: boolean;
  isManager: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

export function useSidebarAccess() {
  const { isAdmin, isAgencyOwner, isKeyEmployee, hasTierAccess } = useAuth();
  const { effectiveRole, loading, agencyId } = useUserPermissions();

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
    return (item: NavItem, callScoringEnabled: boolean): boolean => {
      // Check adminOnly flag - system admins and beta agencies can see these items
      if (item.adminOnly && !userAccess.isAdmin && !hasSalesBetaAccess(agencyId)) {
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
    return (config: NavEntry[], callScoringEnabled: boolean): NavEntry[] => {
      return config
        .filter((entry) => {
          if (isNavFolder(entry)) {
            // Check folder-level access first
            return canAccess(entry.access);
          }
          // Check individual item access
          return checkItemAccess(entry, callScoringEnabled);
        })
        .map((entry) => {
          if (isNavFolder(entry)) {
            // Filter items within the folder
            const filteredItems = entry.items.filter((item) =>
              checkItemAccess(item, callScoringEnabled)
            );
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
    loading,
  };
}
