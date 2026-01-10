import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useStaffAuth } from '@/hooks/useStaffAuth';

interface StanContext {
  portal: 'brain' | 'staff';
  current_page: string;
  user_role: string;
  membership_tier: string;
  user_id: string | null;
  staff_user_id: string | null;
  agency_id: string | null;
}

export function useStanContext(): StanContext {
  const location = useLocation();
  const { user, isAdmin, membershipTier, isKeyEmployee, keyEmployeeAgencyId } = useAuth();
  const { user: staffUser } = useStaffAuth();
  
  return useMemo(() => {
    const isStaffPortal = location.pathname.startsWith('/staff');
    
    if (isStaffPortal && staffUser) {
      // Staff Portal user
      return {
        portal: 'staff' as const,
        current_page: location.pathname,
        user_role: staffUser.role?.toLowerCase() === 'manager' ? 'manager' : 'staff',
        membership_tier: staffUser.agency_membership_tier || 'all',
        user_id: null,
        staff_user_id: staffUser.id,
        agency_id: staffUser.agency_id,
      };
    }
    
    if (user) {
      // Brain Portal user
      // Determine role
      let role = 'owner';
      if (isAdmin) {
        role = 'admin';
      } else if (isKeyEmployee) {
        role = 'key_employee';
      }
      
      // Get agency_id (from profile or key employee)
      const agencyId = isKeyEmployee ? keyEmployeeAgencyId : (user.user_metadata?.agency_id || null);
      
      return {
        portal: 'brain' as const,
        current_page: location.pathname,
        user_role: role,
        membership_tier: membershipTier || 'all',
        user_id: user.id,
        staff_user_id: null,
        agency_id: agencyId,
      };
    }
    
    // Default/anonymous
    return {
      portal: 'brain' as const,
      current_page: location.pathname,
      user_role: 'owner',
      membership_tier: 'all',
      user_id: null,
      staff_user_id: null,
      agency_id: null,
    };
  }, [location.pathname, user, staffUser, isAdmin, membershipTier, isKeyEmployee, keyEmployeeAgencyId]);
}
