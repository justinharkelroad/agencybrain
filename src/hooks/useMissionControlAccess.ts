import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { isStrictlyOneOnOne } from '@/utils/tierAccess';

type MissionControlAccessReason =
  | 'admin_preview'
  | 'missing_user'
  | 'key_employee_blocked'
  | 'not_owner'
  | 'owner_preview'
  | 'wrong_tier'
  | 'ok';

export interface MissionControlAccessResult {
  hasAccess: boolean;
  agencyId: string | null;
  ownerUserId: string | null;
  targetOwnerName: string | null;
  agencyName: string | null;
  featureEnabled: boolean;
  reason: MissionControlAccessReason;
}

export function useMissionControlAccess(targetOwnerUserId?: string | null) {
  const { user, isAdmin, isAgencyOwner, isKeyEmployee, membershipTier } = useAuth();

  return useQuery({
    queryKey: [
      'mission-control-access',
      user?.id,
      isAdmin,
      isAgencyOwner,
      isKeyEmployee,
      membershipTier,
      targetOwnerUserId,
    ],
    enabled: isAdmin || !!user?.id,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<MissionControlAccessResult> => {
      if (isAdmin) {
        return {
          hasAccess: true,
          agencyId: null,
          ownerUserId: targetOwnerUserId ?? user?.id ?? null,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: true,
          reason: 'admin_preview',
        };
      }

      if (!user?.id) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: null,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'missing_user',
        };
      }

      if (isKeyEmployee) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'key_employee_blocked',
        };
      }

      if (!isAgencyOwner) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'not_owner',
        };
      }

      if (!isStrictlyOneOnOne(membershipTier)) {
        return {
          hasAccess: false,
          agencyId: null,
          ownerUserId: user.id,
          targetOwnerName: null,
          agencyName: null,
          featureEnabled: false,
          reason: 'wrong_tier',
        };
      }

      return {
        hasAccess: true,
        agencyId: null,
        ownerUserId: user.id,
        targetOwnerName: null,
        agencyName: null,
        featureEnabled: true,
        reason: targetOwnerUserId ? 'ok' : 'owner_preview',
      };
    },
  });
}
