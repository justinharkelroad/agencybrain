import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
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
      const resolveAgencyPrimaryOwner = async (agencyId: string, preferredUserId?: string | null) => {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, agency_id, membership_tier, role')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const eligibleProfiles = (profiles ?? []).filter((profile) => isStrictlyOneOnOne(profile.membership_tier));

        const ownerProfile =
          eligibleProfiles.find((profile) => profile.role === 'admin') ||
          eligibleProfiles.find((profile) => profile.id === preferredUserId) ||
          eligibleProfiles[0] ||
          null;

        return ownerProfile;
      };

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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.agency_id) {
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

      const ownerProfile = await resolveAgencyPrimaryOwner(profile.agency_id, user.id);

      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', profile.agency_id)
        .maybeSingle();

      return {
        hasAccess: true,
        agencyId: profile.agency_id,
        ownerUserId: ownerProfile?.id ?? user.id,
        targetOwnerName: ownerProfile?.full_name || ownerProfile?.email || null,
        agencyName: agency?.name ?? null,
        featureEnabled: true,
        reason: targetOwnerUserId ? 'ok' : 'owner_preview',
      };
    },
  });
}
